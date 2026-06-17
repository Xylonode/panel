import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";

const ADDONS_DIR = join(process.cwd(), "addons");

/** Registry + per-org installs of sandboxed WASM addons. */
@Injectable()
export class AddonsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AddonsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Seeds the registry from bundled addons (panel/api/addons/<id>/...). */
  async onApplicationBootstrap(): Promise<void> {
    if (!existsSync(ADDONS_DIR)) return;
    let seeded = 0;
    for (const dir of readdirSync(ADDONS_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const base = join(ADDONS_DIR, dir.name);
      const manifestPath = join(base, "addon.json");
      const wasmPath = join(base, "addon.wasm");
      if (!existsSync(manifestPath) || !existsSync(wasmPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const wasm = readFileSync(wasmPath);
      await this.prisma.addon.upsert({
        where: { id: manifest.id },
        create: {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          author: manifest.author,
          description: manifest.description,
          manifest,
          wasm,
          published: true, // bundled/first-party addons are trusted
        },
        update: {
          name: manifest.name,
          version: manifest.version,
          author: manifest.author,
          description: manifest.description,
          manifest,
          wasm,
          published: true,
        },
      });
      seeded++;
    }
    this.logger.log(`Seeded ${seeded} addon(s) into the registry`);
  }

  /** Public registry listing — only staff-approved (published) addons. */
  registry() {
    return this.prisma.addon.findMany({
      where: { published: true },
      select: { id: true, name: true, version: true, author: true, description: true, manifest: true },
      orderBy: { name: "asc" },
    });
  }

  async listInstalls(orgId: string) {
    const installs = await this.prisma.addonInstall.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    const addons = await this.prisma.addon.findMany({
      where: { id: { in: installs.map((i) => i.addonId) } },
      select: { id: true, name: true, version: true, description: true, manifest: true },
    });
    const byId = new Map(addons.map((a) => [a.id, a]));
    return installs.map((i) => ({
      id: i.id,
      addonId: i.addonId,
      enabled: i.enabled,
      grantedScopes: i.grantedScopes,
      config: i.config,
      addon: byId.get(i.addonId) ?? null,
    }));
  }

  async install(orgId: string, addonId: string, config?: Record<string, unknown>) {
    const addon = await this.prisma.addon.findUnique({ where: { id: addonId } });
    if (!addon) throw new NotFoundException("Addon not found");
    const existing = await this.prisma.addonInstall.findUnique({
      where: { organizationId_addonId: { organizationId: orgId, addonId } },
    });
    if (existing) throw new ConflictException("Addon already installed");
    const scopes = ((addon.manifest as any)?.permissions ?? []) as string[];
    return this.prisma.addonInstall.create({
      data: {
        organizationId: orgId,
        addonId,
        grantedScopes: scopes,
        config: (config ?? {}) as object,
        enabled: true,
      },
    });
  }

  async setEnabled(orgId: string, installId: string, enabled: boolean) {
    await this.ownInstall(orgId, installId);
    return this.prisma.addonInstall.update({ where: { id: installId }, data: { enabled } });
  }

  async setConfig(orgId: string, installId: string, config: Record<string, unknown>) {
    await this.ownInstall(orgId, installId);
    return this.prisma.addonInstall.update({
      where: { id: installId },
      data: { config: config as object },
    });
  }

  async uninstall(orgId: string, installId: string) {
    const install = await this.ownInstall(orgId, installId);
    await this.prisma.addonInstall.delete({ where: { id: installId } });
    await this.prisma.addonKv.deleteMany({ where: { organizationId: orgId, addonId: install.addonId } });
    await this.prisma.addonLog.deleteMany({ where: { organizationId: orgId, addonId: install.addonId } });
  }

  async logs(orgId: string, installId: string) {
    const install = await this.ownInstall(orgId, installId);
    return this.prisma.addonLog.findMany({
      where: { organizationId: orgId, addonId: install.addonId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async kv(orgId: string, installId: string) {
    const install = await this.ownInstall(orgId, installId);
    return this.prisma.addonKv.findMany({
      where: { organizationId: orgId, addonId: install.addonId },
      orderBy: { key: "asc" },
      select: { key: true, value: true, updatedAt: true },
    });
  }

  private async ownInstall(orgId: string, installId: string) {
    const install = await this.prisma.addonInstall.findFirst({
      where: { id: installId, organizationId: orgId },
    });
    if (!install) throw new NotFoundException("Install not found");
    return install;
  }
}
