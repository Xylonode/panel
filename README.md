# Game Panel

A hosted, multi-tenant game-server control plane — a "Pterodactyl-as-a-Service" alternative
to [Wisp.gg](https://wisp.gg) and [TCAdmin](https://www.tcadmin.com) — with a first-class
sandboxed **addon marketplace**.

**We host the panel.** Customers install our daemon on their own nodes, connect with a
token, and manage Docker-based game servers through the UI. See
[`docs/architecture.md`](docs/architecture.md).

## Monorepo layout

```
panel/api        NestJS control-plane API (auth, orgs, nodes, servers, addons)
panel/web        React + Vite operator SPA
agent/           Go daemon (one per customer node)        [Phase 2+]
packages/protocol    Panel↔daemon wire protocol + hook-bus events
packages/addon-sdk   Addon manifest + permission model
docs/            Architecture & protocol docs
```

## Prerequisites

- Node 22+ and pnpm (`corepack enable`)
- Docker (for local Postgres + Redis, and later for running game servers)
- Go 1.22+ (Phase 2+, for the daemon)

## Quick start (Phase 0)

```bash
pnpm install
cp .env.example .env            # adjust secrets
pnpm dev:db                     # start Postgres + Redis (needs Docker)
pnpm --filter @game-panel/api prisma:generate
pnpm --filter @game-panel/api dev    # API on :3000
pnpm --filter @game-panel/web dev    # SPA on :5173
```

Open http://localhost:5173 — the SPA shows live API/database health.

## Status

Building toward MVP (Phases 0–3): sign up → connect a node → import an egg → run a game
server live. Roadmap and phase breakdown live in the planning notes. Phase 0 (foundations)
is in place; Phase 1 wires up better-auth and multi-tenancy.
