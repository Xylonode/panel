import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { HookEvent } from "@game-panel/protocol";
import { PrismaService } from "../prisma/prisma.service";
import { HookBus } from "../hooks/hook-bus.service";
import { AddonRuntime } from "./addon-runtime.service";

/**
 * Bridges the hook bus to the addon runtime: for every lifecycle event, finds
 * the org's enabled addons that subscribe to it and runs their handlers in the
 * sandbox. Fire-and-forget — a slow/failing addon never blocks the core.
 */
@Injectable()
export class AddonDispatcher implements OnModuleInit {
  private readonly logger = new Logger(AddonDispatcher.name);

  constructor(
    private readonly hooks: HookBus,
    private readonly prisma: PrismaService,
    private readonly runtime: AddonRuntime,
  ) {}

  onModuleInit(): void {
    this.hooks.on("*", (event) => {
      void this.dispatch(event).catch((err) =>
        this.logger.warn(`dispatch failed for ${event.name}: ${(err as Error).message}`),
      );
    });
  }

  private async dispatch(event: HookEvent): Promise<void> {
    const installs = await this.prisma.addonInstall.findMany({
      where: { organizationId: event.orgId, enabled: true },
    });
    if (installs.length === 0) return;

    const addons = await this.prisma.addon.findMany({
      where: { id: { in: installs.map((i) => i.addonId) } },
    });
    const byId = new Map(addons.map((a) => [a.id, a]));

    for (const install of installs) {
      const addon = byId.get(install.addonId);
      if (!addon) continue;
      const hooks = ((addon.manifest as any)?.hooks ?? []) as { on: string; handler: string }[];
      const hook = hooks.find((h) => h.on === event.name);
      if (!hook) continue;
      void this.runtime.run(install, addon as any, event, hook.handler);
    }
  }
}
