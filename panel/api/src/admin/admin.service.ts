import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DaemonGateway } from "../nodes/daemon.gateway";

function countMap(rows: { organizationId: string; _count: number }[]): Map<string, number> {
  return new Map(rows.map((r) => [r.organizationId, r._count]));
}

/** Cross-tenant oversight for platform staff. No org scoping — sees everything. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DaemonGateway,
  ) {}

  async overview() {
    const [users, orgs, nodes, servers, addons, suspended] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.node.count(),
      this.prisma.server.count(),
      this.prisma.addon.count(),
      this.prisma.orgModeration.count({ where: { suspended: true } }),
    ]);
    return { users, orgs, nodes, servers, addons, nodesOnline: this.gateway.getOnlineNodeIds().size, suspendedOrgs: suspended };
  }

  async listOrgs() {
    const orgs = await this.prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
    const [members, nodes, servers, mods] = await Promise.all([
      this.prisma.member.groupBy({ by: ["organizationId"], _count: true }),
      this.prisma.node.groupBy({ by: ["organizationId"], _count: true }),
      this.prisma.server.groupBy({ by: ["organizationId"], _count: true }),
      this.prisma.orgModeration.findMany(),
    ]);
    const mc = countMap(members as any);
    const nc = countMap(nodes as any);
    const sc = countMap(servers as any);
    const modMap = new Map(mods.map((m) => [m.organizationId, m]));
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      createdAt: o.createdAt,
      members: mc.get(o.id) ?? 0,
      nodes: nc.get(o.id) ?? 0,
      servers: sc.get(o.id) ?? 0,
      suspended: modMap.get(o.id)?.suspended ?? false,
      reason: modMap.get(o.id)?.reason ?? null,
    }));
  }

  async listNodes() {
    const [nodes, orgs] = await Promise.all([
      this.prisma.node.findMany({ orderBy: { createdAt: "desc" } }),
      this.orgNameMap(),
    ]);
    const online = this.gateway.getOnlineNodeIds();
    return nodes.map((n) => ({
      id: n.id,
      name: n.name,
      org: orgs.get(n.organizationId) ?? n.organizationId,
      status: online.has(n.id) ? "online" : "offline",
      daemonVersion: n.daemonVersion,
      dockerAvailable: n.dockerAvailable,
      cpuCores: n.cpuCores,
      memoryMiB: n.memoryMiB,
    }));
  }

  async listServers() {
    const [servers, orgs] = await Promise.all([
      this.prisma.server.findMany({ orderBy: { createdAt: "desc" } }),
      this.orgNameMap(),
    ]);
    return servers.map((s) => ({
      id: s.id,
      name: s.name,
      org: orgs.get(s.organizationId) ?? s.organizationId,
      nodeId: s.nodeId,
      state: s.state,
      primaryPort: s.primaryPort,
      memoryMiB: s.memoryMiB,
    }));
  }

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });
  }

  suspendOrg(orgId: string, suspended: boolean, reason?: string) {
    return this.prisma.orgModeration.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, suspended, reason: reason ?? null },
      update: { suspended, reason: reason ?? null },
    });
  }

  listAddons() {
    return this.prisma.addon.findMany({
      select: { id: true, name: true, version: true, author: true, published: true },
      orderBy: { name: "asc" },
    });
  }

  setAddonPublished(addonId: string, published: boolean) {
    return this.prisma.addon.update({ where: { id: addonId }, data: { published } });
  }

  private async orgNameMap(): Promise<Map<string, string>> {
    const orgs = await this.prisma.organization.findMany({ select: { id: true, name: true } });
    return new Map(orgs.map((o) => [o.id, o.name]));
  }
}
