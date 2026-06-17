import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DaemonGateway } from "./daemon.gateway";
import { generateNodeToken } from "./node-token";

export interface NodeView {
  id: string;
  name: string;
  description: string | null;
  status: "online" | "offline";
  lastSeenAt: Date | null;
  daemonVersion: string | null;
  dockerAvailable: boolean;
  cpuCores: number | null;
  memoryMiB: number | null;
  diskMiB: number | null;
  createdAt: Date;
}

/** Org-scoped CRUD for nodes. Every method takes the caller's orgId. */
@Injectable()
export class NodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DaemonGateway,
  ) {}

  async list(orgId: string): Promise<NodeView[]> {
    const online = this.gateway.getOnlineNodeIds();
    const nodes = await this.prisma.node.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    return nodes.map((n) => this.toView(n, online));
  }

  /** Creates a node and returns the view plus the plaintext token (shown once). */
  async create(
    orgId: string,
    input: { name: string; description?: string },
  ): Promise<{ node: NodeView; token: string }> {
    const { token, tokenHash } = generateNodeToken();
    const node = await this.prisma.node.create({
      data: {
        organizationId: orgId,
        name: input.name,
        description: input.description ?? null,
        tokenHash,
      },
    });
    return { node: this.toView(node, this.gateway.getOnlineNodeIds()), token };
  }

  async remove(orgId: string, nodeId: string): Promise<void> {
    const { count } = await this.prisma.node.deleteMany({
      where: { id: nodeId, organizationId: orgId },
    });
    if (count === 0) throw new NotFoundException("Node not found");
  }

  /** Issues a fresh token for an existing node, invalidating the old one. */
  async rotateToken(orgId: string, nodeId: string): Promise<{ token: string }> {
    const node = await this.prisma.node.findFirst({
      where: { id: nodeId, organizationId: orgId },
    });
    if (!node) throw new NotFoundException("Node not found");
    const { token, tokenHash } = generateNodeToken();
    await this.prisma.node.update({ where: { id: node.id }, data: { tokenHash } });
    return { token };
  }

  private toView(
    n: {
      id: string;
      name: string;
      description: string | null;
      lastSeenAt: Date | null;
      daemonVersion: string | null;
      dockerAvailable: boolean;
      cpuCores: number | null;
      memoryMiB: number | null;
      diskMiB: number | null;
      createdAt: Date;
    },
    online: Set<string>,
  ): NodeView {
    return {
      id: n.id,
      name: n.name,
      description: n.description,
      status: online.has(n.id) ? "online" : "offline",
      lastSeenAt: n.lastSeenAt,
      daemonVersion: n.daemonVersion,
      dockerAvailable: n.dockerAvailable,
      cpuCores: n.cpuCores,
      memoryMiB: n.memoryMiB,
      diskMiB: n.diskMiB,
      createdAt: n.createdAt,
    };
  }
}
