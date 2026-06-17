import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PanelToDaemon, ServerSpec } from "@game-panel/protocol";
import { PrismaService } from "../prisma/prisma.service";
import { DaemonGateway } from "../nodes/daemon.gateway";
import { HookBus } from "../hooks/hook-bus.service";
import { EggsService, type EggVariable } from "./eggs.service";

const PORT_RANGE_START = 25565;
const PORT_RANGE_END = 25665;

export type PowerAction = "start" | "stop" | "restart" | "kill";

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eggs: EggsService,
    private readonly gateway: DaemonGateway,
    private readonly hooks: HookBus,
  ) {}

  list(orgId: string) {
    return this.prisma.server.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(orgId: string, serverId: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId: orgId },
    });
    if (!server) throw new NotFoundException("Server not found");
    return server;
  }

  async create(
    orgId: string,
    input: {
      nodeId: string;
      eggId: string;
      name: string;
      memoryMiB?: number;
      cpuPercent?: number;
      diskMiB?: number;
      environment?: Record<string, string>;
    },
  ) {
    await this.assertNotSuspended(orgId);
    const node = await this.prisma.node.findFirst({
      where: { id: input.nodeId, organizationId: orgId },
    });
    if (!node) throw new NotFoundException("Node not found");
    const egg = await this.eggs.getAccessible(orgId, input.eggId);

    const port = await this.allocatePort(input.nodeId);

    const server = await this.prisma.server.create({
      data: {
        organizationId: orgId,
        nodeId: input.nodeId,
        eggId: egg.id,
        name: input.name,
        dockerImage: egg.dockerImage,
        startup: egg.startup,
        stopCommand: egg.stopCommand,
        environment: input.environment ?? {},
        memoryMiB: input.memoryMiB ?? 1024,
        cpuPercent: input.cpuPercent ?? 100,
        diskMiB: input.diskMiB ?? 5120,
        primaryPort: port,
        state: "installing",
      },
    });

    // Provision on the node (pull image + create container). Best-effort: if the
    // daemon is offline the server stays "installing" until it reconnects and is
    // (re)provisioned.
    this.gateway.send(node.id, {
      type: "server.create",
      payload: {
        serverId: server.id,
        spec: this.buildSpec(server, egg.variables as unknown as EggVariable[]),
      },
    });

    this.hooks.emit("server.created", orgId, { serverId: server.id, nodeId: node.id });
    return server;
  }

  async power(orgId: string, serverId: string, action: PowerAction) {
    // Suspended orgs may still stop/kill, but not start/restart.
    if (action === "start" || action === "restart") await this.assertNotSuspended(orgId);
    const server = await this.get(orgId, serverId);
    if (!this.gateway.getOnlineNodeIds().has(server.nodeId)) {
      throw new ConflictException("Node is offline");
    }

    if (action === "stop" && server.stopCommand) {
      // Graceful: send the console stop command, then ask the daemon to stop.
      this.gateway.send(server.nodeId, {
        type: "server.command",
        payload: { serverId, command: server.stopCommand },
      });
    }
    this.gateway.send(server.nodeId, {
      type: `server.${action}`,
      payload: { serverId },
    } as PanelToDaemon);
    return { ok: true };
  }

  async sendCommand(orgId: string, serverId: string, command: string) {
    const server = await this.get(orgId, serverId);
    const sent = this.gateway.send(server.nodeId, {
      type: "server.command",
      payload: { serverId, command },
    });
    if (!sent) throw new ConflictException("Node is offline");
    return { ok: true };
  }

  async remove(orgId: string, serverId: string) {
    const server = await this.get(orgId, serverId);
    this.gateway.send(server.nodeId, { type: "server.delete", payload: { serverId } });
    await this.prisma.server.delete({ where: { id: server.id } });
    this.hooks.emit("server.deleted", orgId, { serverId });
  }

  /** Resolves the egg's variables + system vars into the daemon spec. */
  private buildSpec(
    server: {
      dockerImage: string;
      startup: string;
      environment: unknown;
      memoryMiB: number;
      cpuPercent: number;
      diskMiB: number;
      primaryPort: number;
    },
    variables: EggVariable[],
  ): ServerSpec {
    const overrides = (server.environment ?? {}) as Record<string, string>;
    const env: Record<string, string> = {};
    for (const v of variables) {
      env[v.envVariable] = overrides[v.envVariable] ?? v.defaultValue;
    }
    // System-injected vars (image-specific conventions for itzg/minecraft).
    env.SERVER_PORT = String(server.primaryPort);
    env.MAX_MEMORY = `${server.memoryMiB}M`;

    return {
      image: server.dockerImage,
      startup: server.startup,
      env,
      limits: {
        memoryMiB: server.memoryMiB,
        cpuPercent: server.cpuPercent,
        diskMiB: server.diskMiB,
      },
      ports: [
        {
          ip: "0.0.0.0",
          hostPort: server.primaryPort,
          containerPort: server.primaryPort,
          protocol: "tcp",
        },
      ],
    };
  }

  private async assertNotSuspended(orgId: string): Promise<void> {
    const mod = await this.prisma.orgModeration.findUnique({ where: { organizationId: orgId } });
    if (mod?.suspended) {
      throw new ForbiddenException("This organization is suspended. Contact support.");
    }
  }

  private async allocatePort(nodeId: string): Promise<number> {
    const used = await this.prisma.server.findMany({
      where: { nodeId },
      select: { primaryPort: true },
    });
    const taken = new Set(used.map((s) => s.primaryPort));
    for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
      if (!taken.has(p)) return p;
    }
    throw new BadRequestException("No free ports on this node");
  }
}
