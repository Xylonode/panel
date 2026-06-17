import { Injectable, Logger } from "@nestjs/common";
import type { HookEvent } from "@game-panel/protocol";
import { PrismaService } from "../prisma/prisma.service";

// Real ESM dynamic import from CommonJS (bypasses TS down-leveling to require()).
const esmImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;

interface Effects {
  log?: unknown[];
  kvSet?: Record<string, unknown>;
  kvDelete?: string[];
  webhooks?: { url: string; body?: string }[];
}

interface CachedPlugin {
  version: string;
  plugin: any;
  lock: Promise<unknown>;
}

const MAX_LOG_LEN = 1000;
const MAX_LOGS_PER_ADDON = 200;

/**
 * Runs addon WASM in the Extism sandbox. The addon is a pure function:
 * on_event(input) -> { effects }. The host enforces the granted capability
 * scopes when applying those effects (log / kv / webhooks). No ambient
 * authority reaches the WASM.
 */
@Injectable()
export class AddonRuntime {
  private readonly logger = new Logger(AddonRuntime.name);
  private createPlugin?: (manifest: unknown, opts: unknown) => Promise<any>;
  private readonly cache = new Map<string, CachedPlugin>();

  constructor(private readonly prisma: PrismaService) {}

  async run(
    install: { id: string; organizationId: string; grantedScopes: unknown; config: unknown },
    addon: { id: string; version: string; manifest: any; wasm: Buffer },
    event: HookEvent,
    handler: string,
  ): Promise<void> {
    try {
      const kv = await this.loadKv(install.organizationId, addon.id);
      const input = JSON.stringify({ event, config: install.config ?? {}, kv });

      const cached = await this.getPlugin(addon);
      const output: string = await this.withLock(cached, async () => {
        const out = await cached.plugin.call(handler, input);
        return out ? out.text() : "";
      });
      if (!output) return;

      const parsed = JSON.parse(output) as { effects?: Effects };
      await this.applyEffects(install, addon, parsed.effects ?? {});
    } catch (err) {
      this.logger.warn(`addon ${addon.id} handler ${handler} failed: ${(err as Error).message}`);
      await this.writeLog(install.organizationId, addon.id, "error", `runtime error: ${(err as Error).message}`);
    }
  }

  private async getPlugin(addon: { id: string; version: string; manifest: any; wasm: Buffer }): Promise<CachedPlugin> {
    const existing = this.cache.get(addon.id);
    if (existing && existing.version === addon.version) return existing;
    if (existing) await existing.plugin.close?.().catch(() => undefined);

    if (!this.createPlugin) {
      const mod = await esmImport("@extism/extism");
      this.createPlugin = mod.default;
    }

    const limits = addon.manifest?.limits ?? {};
    const memoryMiB = Number(limits.memoryMiB ?? 32);
    const manifest = {
      wasm: [{ data: addon.wasm }],
      timeout_ms: Number(limits.timeoutMs ?? 2000),
      memory: { max_pages: Math.ceil(memoryMiB * 16) }, // 1 page = 64KiB
    };
    const plugin = await this.createPlugin!(manifest, { useWasi: true, runInWorker: true });
    const entry: CachedPlugin = { version: addon.version, plugin, lock: Promise.resolve() };
    this.cache.set(addon.id, entry);
    return entry;
  }

  /** Serializes calls to a single plugin instance (Extism plugins are not concurrent). */
  private withLock<T>(entry: CachedPlugin, fn: () => Promise<T>): Promise<T> {
    const next = entry.lock.then(fn, fn);
    entry.lock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async applyEffects(
    install: { organizationId: string; grantedScopes: unknown },
    addon: { id: string; manifest: any },
    effects: Effects,
  ): Promise<void> {
    const scopes = new Set((install.grantedScopes as string[]) ?? []);

    for (const line of effects.log ?? []) {
      await this.writeLog(install.organizationId, addon.id, "info", String(line));
    }

    if (effects.kvSet && scopes.has("kv:write")) {
      for (const [key, value] of Object.entries(effects.kvSet)) {
        await this.prisma.addonKv.upsert({
          where: {
            organizationId_addonId_key: {
              organizationId: install.organizationId,
              addonId: addon.id,
              key,
            },
          },
          create: { organizationId: install.organizationId, addonId: addon.id, key, value: String(value) },
          update: { value: String(value) },
        });
      }
    }

    if (effects.kvDelete && scopes.has("kv:write")) {
      await this.prisma.addonKv.deleteMany({
        where: { organizationId: install.organizationId, addonId: addon.id, key: { in: effects.kvDelete } },
      });
    }

    if (effects.webhooks && scopes.has("net:fetch")) {
      const allow = (addon.manifest?.network?.allow ?? []) as string[];
      for (const wh of effects.webhooks) {
        if (!this.hostAllowed(wh.url, allow)) {
          await this.writeLog(install.organizationId, addon.id, "warn", `blocked webhook to ${wh.url} (not on allowlist)`);
          continue;
        }
        void fetch(wh.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: wh.body ?? "{}",
        }).catch(() => undefined);
      }
    }
  }

  private hostAllowed(url: string, allow: string[]): boolean {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return false;
    }
    return allow.some((a) => host === a || host.endsWith(`.${a}`));
  }

  private async loadKv(orgId: string, addonId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.addonKv.findMany({
      where: { organizationId: orgId, addonId },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  private async writeLog(orgId: string, addonId: string, level: string, message: string): Promise<void> {
    await this.prisma.addonLog.create({
      data: { organizationId: orgId, addonId, level, message: message.slice(0, MAX_LOG_LEN) },
    });
    // Keep the activity feed bounded.
    const count = await this.prisma.addonLog.count({ where: { organizationId: orgId, addonId } });
    if (count > MAX_LOGS_PER_ADDON) {
      const old = await this.prisma.addonLog.findMany({
        where: { organizationId: orgId, addonId },
        orderBy: { createdAt: "asc" },
        take: count - MAX_LOGS_PER_ADDON,
        select: { id: true },
      });
      await this.prisma.addonLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  }
}
