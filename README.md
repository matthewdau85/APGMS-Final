# APGMS (Monorepo)

APGMS is a TypeScript monorepo for an API gateway + supporting packages (domain policy, ledger) and a webapp demo.
This repo is designed to be **deterministic**, **testable**, and **release-oriented**.

## What’s in here

- `services/api-gateway/` — Fastify gateway (auth, CORS, security headers, metrics, prototype routes)
- `packages/domain-policy/` — deterministic tax/outcome logic + assurance tests
- `packages/ledger/` — ledger primitives + idempotent journal writing tests
- `shared/` — Prisma client + shared utilities
- `webapp/` — Vite webapp (demo)
- `scripts/verify.sh` — deep verification entry point

---

## Tooling

- Node (via corepack)
- pnpm
- Prisma (generated client lives under `node_modules`)

Enable pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
