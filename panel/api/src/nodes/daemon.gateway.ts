import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { DaemonToPanel, PanelToDaemon } from "@game-panel/protocol";
import { PrismaService } from "../prisma/prisma.service";
import { hashNodeToken } from "./node-token";

const DAEMON_PATH = "/api/daemon";

interface Connection {
  socket: WebSocket;
  nodeId: string;
  orgId: string;
}

/**
 * The dial-in endpoint for node daemons. Daemons live on customer networks and
 * open an outbound WebSocket to us (no inbound ports needed on their side). They
 * authenticate with their node token; we track live connections in-memory so the
 * panel can report online/offline and (Phase 3) push commands down the pipe.
 */
@Injectable()
export class DaemonGateway implements OnApplicationBootstrap {
  private readonly logger = new Logger(DaemonGateway.name);
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly connections = new Map<string, Connection>();

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.adapterHost.httpAdapter.getHttpServer();
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.handleUpgrade(req, socket, head);
    });
  }

  /** Node ids with a live daemon connection right now. */
  getOnlineNodeIds(): Set<string> {
    return new Set(this.connections.keys());
  }

  /** Send a command to a node's daemon. Returns false if it isn't connected. */
  send(nodeId: string, message: PanelToDaemon): boolean {
    const conn = this.connections.get(nodeId);
    if (!conn || conn.socket.readyState !== WebSocket.OPEN) return false;
    conn.socket.send(JSON.stringify(message));
    return true;
  }

  private async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== DAEMON_PATH) return; // not ours

    const token = this.extractToken(req, url);
    if (!token) return this.reject(socket, 401, "Missing token");

    const node = await this.prisma.node.findUnique({
      where: { tokenHash: hashNodeToken(token) },
    });
    if (!node) return this.reject(socket, 401, "Invalid token");

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.register(ws, { nodeId: node.id, orgId: node.organizationId });
    });
  }

  private register(socket: WebSocket, ctx: { nodeId: string; orgId: string }): void {
    // Replace any stale connection for the same node.
    this.connections.get(ctx.nodeId)?.socket.close(4000, "Replaced by new connection");
    this.connections.set(ctx.nodeId, { socket, ...ctx });
    this.logger.log(`Daemon connected: node=${ctx.nodeId} (${this.connections.size} online)`);
    void this.touch(ctx.nodeId);

    socket.on("message", (data) => void this.onMessage(ctx.nodeId, data.toString()));
    socket.on("close", () => {
      if (this.connections.get(ctx.nodeId)?.socket === socket) {
        this.connections.delete(ctx.nodeId);
      }
      void this.touch(ctx.nodeId);
      this.logger.log(`Daemon disconnected: node=${ctx.nodeId} (${this.connections.size} online)`);
    });
    socket.on("error", (err) => this.logger.warn(`Daemon socket error node=${ctx.nodeId}: ${err.message}`));
  }

  private async onMessage(nodeId: string, raw: string): Promise<void> {
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
        break;
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
        break;
      }
      default:
        // Phase 3 handles server.* state/stats/console events.
        break;
    }
  }

  private async touch(nodeId: string): Promise<void> {
    await this.prisma.node
      .update({ where: { id: nodeId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  private extractToken(req: IncomingMessage, url: URL): string | null {
    const auth = req.headers["authorization"];
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice("Bearer ".length).trim();
    }
    return url.searchParams.get("token");
  }

  private reject(socket: Duplex, code: number, reason: string): void {
    socket.write(`HTTP/1.1 ${code} ${reason}\r\n\r\n`);
    socket.destroy();
  }
}
