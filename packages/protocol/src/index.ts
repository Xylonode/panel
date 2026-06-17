/**
 * Shared contracts between the panel, the Go daemon, and the addon runtime.
 *
 * Two concerns live here:
 *  1. The panel <-> daemon wire protocol (the persistent WebSocket the daemon
 *     dials out to the panel — see docs/architecture.md).
 *  2. The internal hook-bus event contracts that the addon runtime subscribes to.
 *
 * The Go daemon mirrors these shapes; keep field names in sync with agent/.
 */

export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Panel <-> Daemon wire protocol
// ---------------------------------------------------------------------------

/** Lifecycle state of a single game server container, reported by the daemon. */
export type ServerState =
  | "installing"
  | "offline"
  | "starting"
  | "running"
  | "stopping"
  | "crashed";

/** Connection/health state of a node's daemon, tracked by the panel. */
export type NodeStatus = "online" | "offline" | "unauthorized";

/**
 * Every frame on the control channel shares this envelope. Requests carry an
 * `id` so the sender can correlate the matching response; events omit it.
 */
export interface Envelope<T extends string = string, P = unknown> {
  /** Discriminator, e.g. "server.start" or "event.server.state". */
  type: T;
  /** Correlation id for request/response pairs. Absent on fire-and-forget events. */
  id?: string;
  /** Type-specific payload. */
  payload: P;
}

/** Commands the panel sends DOWN to the daemon. */
export type PanelToDaemon =
  | Envelope<"server.create", { serverId: string; spec: ServerSpec }>
  | Envelope<"server.start", { serverId: string }>
  | Envelope<"server.stop", { serverId: string }>
  | Envelope<"server.restart", { serverId: string }>
  | Envelope<"server.kill", { serverId: string }>
  | Envelope<"server.delete", { serverId: string }>
  | Envelope<"server.command", { serverId: string; command: string }>
  | Envelope<"console.subscribe", { serverId: string }>
  | Envelope<"console.unsubscribe", { serverId: string }>;

/** Messages the daemon sends UP to the panel (responses + events). */
export type DaemonToPanel =
  | Envelope<"hello", { daemonVersion: string; protocolVersion: number; docker: boolean }>
  | Envelope<"heartbeat", { resources: HostResources }>
  | Envelope<"ack", { ok: true } | { ok: false; error: string }>
  | Envelope<"event.server.state", { serverId: string; state: ServerState; exitCode?: number }>
  | Envelope<"event.server.stats", { serverId: string; stats: ServerStats }>
  | Envelope<"event.console.line", { serverId: string; line: string; stream: "stdout" | "stderr" }>;

/** What the panel hands the daemon to materialize a Docker container. */
export interface ServerSpec {
  image: string;
  /** Resolved startup command after egg variable substitution. */
  startup: string;
  /** Environment variables (egg variables + system). */
  env: Record<string, string>;
  limits: ResourceLimits;
  /** host:container port bindings derived from allocations. */
  ports: PortBinding[];
}

export interface ResourceLimits {
  /** Memory hard limit in MiB. */
  memoryMiB: number;
  /** CPU limit as a percentage of one core (100 = 1 core). */
  cpuPercent: number;
  /** Disk quota in MiB. */
  diskMiB: number;
}

export interface PortBinding {
  ip: string;
  hostPort: number;
  containerPort: number;
  protocol: "tcp" | "udp";
}

export interface HostResources {
  cpuCores: number;
  memoryTotalMiB: number;
  memoryUsedMiB: number;
  diskTotalMiB: number;
  diskUsedMiB: number;
}

export interface ServerStats {
  cpuPercent: number;
  memoryMiB: number;
  diskMiB: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

// ---------------------------------------------------------------------------
// Internal hook-bus events (consumed by the addon runtime)
// ---------------------------------------------------------------------------

/** Canonical names of lifecycle events the core emits onto the hook bus. */
export type HookEventName =
  | "server.created"
  | "server.deleted"
  | "server.started"
  | "server.stopped"
  | "server.crashed"
  | "node.connected"
  | "node.disconnected"
  | "backup.completed";

/** Envelope every hook-bus event carries. Always scoped to an org for isolation. */
export interface HookEvent<P = unknown> {
  name: HookEventName;
  orgId: string;
  /** ISO-8601 timestamp set by the emitter. */
  at: string;
  payload: P;
}
