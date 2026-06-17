import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { WebSocketServer, WebSocket } from "ws";
import { fromNodeHeaders } from "better-auth/node";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type {
  DaemonToPanel,
  FilesResult,
  HookEventName,
  PanelToDaemon,
  ServerState,
} from "@game-panel/protocol";
import { PrismaService } from "../prisma/prisma.service";
import { HookBus } from "../hooks/hook-bus.service";
import { auth } from "../auth/auth";
import { hashNodeToken } from "./node-token";

const DAEMON_PATH = "/api/daemon";
const CONSOLE_PATH = "/api/console";

interface DaemonConn {
  socket: WebSocket;
  nodeId: string;
  orgId: string;
}

interface ConsoleConn {
  socket: WebSocket;
  serverId: string;
  nodeId: string;
}

/** Maps a daemon-reported server state to a hook-bus lifecycle event, if any. */
const STATE_HOOK: Partial<Record<ServerState, HookEventName>> = {
  running: "server.started",
  offline: "server.stopped",
  crashed: "server.crashed",
};

/**
 * Owns both ends of the realtime fabric:
 *  - daemons dialing in on /api/daemon (authenticated by node token)
 *  - browser consoles on /api/console (authenticated by better-auth session)
 * and relays console/stats/state between them, persisting state + emitting
 * hook-bus events along the way.
 */
@Injectable()
export class DaemonGateway implements OnApplicationBootstrap {
  private readonly logger = new Logger(DaemonGateway.name);
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly daemons = new Map<string, DaemonConn>();
  private readonly consoles = new Map<string, Set<ConsoleConn>>(); // serverId -> browsers
  private readonly serverMeta = new Map<string, { nodeId: string; orgId: string }>();
  private readonly pending = new Map<
    string,
    { nodeId: string; resolve: (r: FilesResult) => void; timer: NodeJS.Timeout }
  >();

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly prisma: PrismaService,
    private readonly hooks: HookBus,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.adapterHost.httpAdapter.getHttpServer();
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.handleUpgrade(req, socket, head);
    });
  }

  getOnlineNodeIds(): Set<string> {
    return new Set(this.daemons.keys());
  }

  send(nodeId: string, message: PanelToDaemon): boolean {
    const conn = this.daemons.get(nodeId);
    if (!conn || conn.socket.readyState !== WebSocket.OPEN) return false;
    conn.socket.send(JSON.stringify(message));
    return true;
  }

  /** Sends a command and awaits the daemon's correlated files.result reply. */
  request(nodeId: string, message: PanelToDaemon, timeoutMs = 15000): Promise<FilesResult> {
    const conn = this.daemons.get(nodeId);
    if (!conn || conn.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Node is offline"));
    }
    const id = randomUUID();
    return new Promise<FilesResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Daemon request timed out"));
      }, timeoutMs);
      this.pending.set(id, { nodeId, resolve, timer });
      conn.socket.send(JSON.stringify({ ...message, id }));
    });
  }

  private async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname === DAEMON_PATH) return this.handleDaemonUpgrade(req, socket, head);
    if (url.pathname === CONSOLE_PATH) return this.handleConsoleUpgrade(req, socket, head, url);
  }

  // --- daemon side ---

  private async handleDaemonUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const token = this.extractToken(req, new URL(req.url ?? "", "http://localhost"));
    if (!token) return this.reject(socket, 401, "Missing token");
    const node = await this.prisma.node.findUnique({ where: { tokenHash: hashNodeToken(token) } });
    if (!node) return this.reject(socket, 401, "Invalid token");
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.registerDaemon(ws, { nodeId: node.id, orgId: node.organizationId });
    });
  }

  private registerDaemon(socket: WebSocket, ctx: { nodeId: string; orgId: string }): void {
    this.daemons.get(ctx.nodeId)?.socket.close(4000, "Replaced");
    this.daemons.set(ctx.nodeId, { socket, ...ctx });
    this.logger.log(`Daemon connected: node=${ctx.nodeId} (${this.daemons.size} online)`);
    void this.touch(ctx.nodeId);

    socket.on("message", (data) => void this.onDaemonMessage(ctx.nodeId, data.toString()));
    socket.on("close", () => {
      if (this.daemons.get(ctx.nodeId)?.socket === socket) this.daemons.delete(ctx.nodeId);
      void this.touch(ctx.nodeId);
      this.logger.log(`Daemon disconnected: node=${ctx.nodeId} (${this.daemons.size} online)`);
    });
    socket.on("error", (err) => this.logger.warn(`Daemon socket error node=${ctx.nodeId}: ${err.message}`));
  }

  private async onDaemonMessage(nodeId: string, raw: string): Promise<void> {
    let msg: DaemonToPanel;
    try {
      msg = JSON.parse(raw) as DaemonToPanel;
    } catch {
      return;
    }

    switch (msg.type) {
      case "hello":
        await this.prisma.node.update({
          where: { id: nodeId },
          data: {
            daemonVersion: msg.payload.daemonVersion,
            dockerAvailable: msg.payload.docker,
            lastSeenAt: new Date(),
          },
        });
        return;
      case "heartbeat": {
        const r = msg.payload.resources;
        await this.prisma.node.update({
          where: { id: nodeId },
          data: {
            lastSeenAt: new Date(),
            cpuCores: r.cpuCores,
            memoryMiB: Math.round(r.memoryTotalMiB),
            diskMiB: Math.round(r.diskTotalMiB),
          },
        });
        return;
      }
      case "event.server.state": {
        const meta = await this.ownedServerMeta(msg.payload.serverId, nodeId);
        if (!meta) return;
        await this.prisma.server.update({
          where: { id: msg.payload.serverId },
          data: { state: msg.payload.state },
        });
        const hook = STATE_HOOK[msg.payload.state];
        if (hook) this.hooks.emit(hook, meta.orgId, { serverId: msg.payload.serverId });
        this.fanout(msg.payload.serverId, raw);
        return;
      }
      case "event.console.line":
      case "event.server.stats": {
        const meta = await this.ownedServerMeta(msg.payload.serverId, nodeId);
        if (!meta) return;
        this.fanout(msg.payload.serverId, raw);
        return;
      }
      case "files.result": {
        const id = msg.id;
        if (!id) return;
        const p = this.pending.get(id);
        if (!p || p.nodeId !== nodeId) return; // only the asked node may answer
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.resolve(msg.payload);
        return;
      }
      default:
        return;
    }
  }

  // --- browser console side ---

  private async handleConsoleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    url: URL,
  ): Promise<void> {
    const serverId = url.searchParams.get("server");
    if (!serverId) return this.reject(socket, 400, "Missing server");

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const orgId = session?.session.activeOrganizationId;
    if (!session || !orgId) return this.reject(socket, 401, "Not authenticated");

    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      select: { id: true, nodeId: true },
    });
    if (!server) return this.reject(socket, 404, "Server not found");

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.registerConsole(ws, { socket: ws, serverId, nodeId: server.nodeId });
    });
  }

  private registerConsole(socket: WebSocket, conn: ConsoleConn): void {
    let set = this.consoles.get(conn.serverId);
    if (!set) {
      set = new Set();
      this.consoles.set(conn.serverId, set);
    }
    set.add(conn);
    this.send(conn.nodeId, { type: "console.subscribe", payload: { serverId: conn.serverId } });

    socket.on("message", (data) => {
      try {
        const { command } = JSON.parse(data.toString()) as { command?: string };
        if (command) {
          this.send(conn.nodeId, {
            type: "server.command",
            payload: { serverId: conn.serverId, command },
          });
        }
      } catch {
        /* ignore malformed client frames */
      }
    });
    socket.on("close", () => {
      const subs = this.consoles.get(conn.serverId);
      subs?.delete(conn);
      if (subs && subs.size === 0) {
        this.consoles.delete(conn.serverId);
        this.send(conn.nodeId, { type: "console.unsubscribe", payload: { serverId: conn.serverId } });
      }
    });
  }

  /** Forwards a raw daemon event frame to every browser watching that server. */
  private fanout(serverId: string, raw: string): void {
    const subs = this.consoles.get(serverId);
    if (!subs) return;
    for (const c of subs) {
      if (c.socket.readyState === WebSocket.OPEN) c.socket.send(raw);
    }
  }

  /** Returns the server's org if it is owned by `nodeId`; caches the mapping. */
  private async ownedServerMeta(
    serverId: string,
    nodeId: string,
  ): Promise<{ nodeId: string; orgId: string } | null> {
    let meta = this.serverMeta.get(serverId);
    if (!meta) {
      const s = await this.prisma.server.findUnique({
        where: { id: serverId },
        select: { nodeId: true, organizationId: true },
      });
      if (!s) return null;
      meta = { nodeId: s.nodeId, orgId: s.organizationId };
      this.serverMeta.set(serverId, meta);
    }
    return meta.nodeId === nodeId ? meta : null;
  }

  private async touch(nodeId: string): Promise<void> {
    await this.prisma.node
      .update({ where: { id: nodeId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  private extractToken(req: IncomingMessage, url: URL): string | null {
    const authHeader = req.headers["authorization"];
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      return authHeader.slice("Bearer ".length).trim();
    }
    return url.searchParams.get("token");
  }

  private reject(socket: Duplex, code: number, reason: string): void {
    socket.write(`HTTP/1.1 ${code} ${reason}\r\n\r\n`);
    socket.destroy();
  }
}
