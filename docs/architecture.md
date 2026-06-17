# Architecture

Game Panel is a hosted, multi-tenant control plane for game servers — a
"Pterodactyl-as-a-Service" alternative to Wisp.gg and TCAdmin — with a first-class
sandboxed addon/marketplace platform.

## The model in one paragraph

**We host the panel.** Customers (hosting companies or individuals) sign up, get an
organization, install **our daemon** on **their own nodes**, paste a token, and manage
Docker-based game servers through our UI/API. We never touch their hardware. Because their
daemons live on customer networks behind NAT/firewalls, **the daemon dials out** to the
panel and holds a persistent WebSocket; the panel pushes commands down that pipe. No inbound
ports required on customer nodes.

```
        ┌────────────────────────── We host this ──────────────────────────┐
Browser │  React SPA ─HTTP/WS─> NestJS Panel API ─> Postgres + Redis        │
   │    │                          │  emits events → Hook bus → Addon runtime │
   │    │                          │                (Extism WASM sandbox)      │
   │    └──────────────────────────▲───────────────────────────────────────┘
   │                               │ persistent outbound WS (daemon dials in)
   │                     ┌─────────┴──────────┐  Customer's own nodes
   └─ console WS relay ─>│ Go daemon (1/node) │  (we never reach inbound)
                         │   └─> Docker ─> game server containers
                         └────────────────────┘
```

## Components

| Component | Tech | Responsibility |
|-----------|------|----------------|
| `panel/api` | NestJS + Prisma | Auth (better-auth), orgs, nodes, servers, eggs, allocations, console relay, hook bus, addon runtime + marketplace |
| `panel/web` | React + Vite | Operator SPA; addon host SDK + sandboxed-iframe bridge |
| `agent` | Go | Per-node daemon: control-channel client, Docker manager, file/SFTP, resource stats |
| `packages/protocol` | TS | Panel↔daemon wire protocol + hook-bus event contracts |
| `packages/addon-sdk` | TS | Addon manifest + permission model for authors |
| Postgres | — | Primary multi-tenant datastore |
| Redis | — | Sessions, BullMQ jobs, console/addon pub-sub |

## Key decisions

- **Multi-tenant from day one** — every domain row carries `organizationId`.
- **Daemon dials out** — survives NAT; "install, paste token, done".
- **Docker runtime** — each game server is a container the daemon manages.
- **Auth = better-auth** — organization + 2FA + apiKey + admin plugins.
- **Addons sandboxed in our cloud** — Extism/WASM, capability-based host functions, no
  ambient authority; declared scopes approved per-org at install.
- **Eggs = Pterodactyl JSON** — reuse the existing game-definition ecosystem.

## Communication paths

1. **Control channel** — daemon → panel WebSocket. Authenticated with the node's apiKey
   token. Heartbeats keep node status fresh. Panel sends `server.*` commands; daemon returns
   acks and pushes `event.*` frames (state, stats, console lines). See
   `packages/protocol`.
2. **Browser console** — browser WS → panel → Redis pub/sub → daemon control channel →
   container stdio. The panel relays; the browser never talks to a daemon directly.
3. **Hook bus** — core services emit typed lifecycle events (`server.started`, …) which the
   addon runtime consumes, dispatching to subscribed addons inside the WASM sandbox.

See also: `wire-protocol.md` (TBD), `addons.md` (TBD), `egg-format.md` (TBD).
