# ATO Ruleset Phase 1 Baseline

- Branch: work-ato-ruleset-phase1 (created from main, clean except for existing dirty files in the working tree)
- Setup: Node 22.21.1 via nvm, corepack enabled, pnpm@latest activated.
- Commands executed:
  - `pnpm -r typecheck` (all workspace typecheck targets pass)
  - `pnpm -r test` (all workspaces pass except api-gateway tests fail because CORS_ALLOWED_ORIGINS is not set in production-mode hooks)
- Outstanding issue: api-gateway tests fail with `Error: CORS_ALLOWED_ORIGINS must be set in production` when NODE_ENV defaults to production; fix will require supplying a allowlist or adjusting the tests.
