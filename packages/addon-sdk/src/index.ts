/**
 * Addon SDK — the contract every marketplace addon ships against.
 *
 * Addons run sandboxed in our control plane (Extism/WASM) with ZERO ambient
 * authority. An addon declares what it touches in its manifest; the org admin
 * approves those scopes at install time; the runtime only exposes the matching
 * host functions. See docs/addons.md.
 */

import type { HookEventName } from "@game-panel/protocol";

export const MANIFEST_VERSION = 1;

/**
 * Capability scopes an addon may request. The runtime gates every host function
 * behind one of these; an un-granted scope means the call is never wired up.
 */
export type PermissionScope =
  // read/write panel resources via host functions
  | "servers:read"
  | "servers:write"
  | "nodes:read"
  | "files:read"
  | "files:write"
  // the addon's own isolated key/value store, namespaced to (org, addon)
  | "kv:read"
  | "kv:write"
  // outbound HTTP, further constrained by `network.allow` host allowlist
  | "net:fetch";

/** Where an addon can surface UI in the panel SPA. */
export type UiSlot =
  | "dashboard.widget"
  | "server.tab"
  | "server.settings"
  | "org.settings"
  | "nav.item";

/** A backend entry point invoked in the sandbox. One WASM export per handler. */
export interface HookBinding {
  /** Lifecycle event that triggers this handler. */
  on: HookEventName;
  /** Name of the exported WASM function to invoke. */
  handler: string;
}

/** Declarative UI contribution. Rich custom UI uses `iframe`; simple uses `component`. */
export interface UiContribution {
  slot: UiSlot;
  title: string;
  /** Built-in declarative component rendered with our design system. */
  component?: "kv-table" | "stat-card" | "form" | "markdown";
  /** ...or a sandboxed iframe entrypoint (relative to the addon bundle). */
  iframe?: string;
  /** Props/config passed to the declarative component. */
  config?: Record<string, unknown>;
}

/** A scheduled (cron) invocation of a backend handler. */
export interface ScheduleBinding {
  /** Standard 5-field cron expression (UTC). */
  cron: string;
  handler: string;
}

/** The addon.json every addon publishes to the marketplace. */
export interface AddonManifest {
  manifestVersion: typeof MANIFEST_VERSION;
  /** Reverse-DNS-ish unique id, e.g. "gg.example.discord-notifier". */
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  /** Capability scopes the addon requests; shown to the org admin at install. */
  permissions: PermissionScope[];
  /** Outbound host allowlist; required when `net:fetch` is requested. */
  network?: { allow: string[] };
  /** Backend lifecycle handlers. */
  hooks?: HookBinding[];
  /** Backend cron handlers. */
  schedules?: ScheduleBinding[];
  /** Frontend contributions. */
  ui?: UiContribution[];
  /** Resource caps the runtime enforces per invocation. */
  limits?: { memoryMiB?: number; timeoutMs?: number };
}
