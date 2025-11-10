# Auth Guard Consolidation Plan

## Summary
- Extracted the Fastify JWT verification and role guard logic from `services/api-gateway` into a dedicated `@apgms/auth` workspace package so that services and apps can share a single implementation and cache of JWKS keys.
- Updated API gateway routes and legacy plugins to consume the shared `authenticateRequest` helper, eliminating locally duplicated role checks and ensuring consistent metrics emission.
- Added package-level regression tests that exercise success, authorization failure, and missing-token flows to protect future refactors.

## Evaluation Findings
- The gateway previously shipped two divergent auth helpers (`src/auth.ts` for session guards and `src/lib/auth.ts` for JWKS verification) plus an outdated plugin under `src/plugins/auth.ts`. These fragmented implementations made it difficult for other apps to reuse the hardened guard and increased the risk of stale role checks.
- No reusable guard existed under `packages/**`, so creating `packages/auth` provides a clear home for Fastify-aware guard helpers while keeping Prisma-centric logic in the services layer.
- The enhanced guard centralizes metrics hooks, strict claim validation, and deterministic hash helpers so that future consumers (services or apps) inherit the same behaviour without manual wiring.

## Incremental Refactor Roadmap
1. **Foundation (this change)**  
   Ship `@apgms/auth`, rewire API gateway routes/plugins to the shared guard, and land regression tests that validate JWKS verification, forbidden roles, and missing-token responses.
2. **Adoption in remaining services**  
   - Migrate any bespoke guards in `services/**` to call `@apgms/auth.authenticateRequest` (or a pre-handler built from it).  
   - Confirm telemetry parity by asserting `metrics.recordSecurityEvent` behaviour in service-specific tests.
3. **Front-end/app integration**  
   - Audit `apps/**` for manual JWT checks or role filters and replace them with thin wrappers around the shared helper.  
   - Introduce component or route-level tests that simulate the required Fastify request context before swapping implementations.
4. **Hardening & cleanup**  
   - Remove the deprecated HS256-only guard once all consumers transition.  
   - Expand Jest coverage in `@apgms/auth` for edge cases (expired tokens, malformed JWKS) before tackling deeper refactors.  
   - Schedule refactors in two-service increments, running `pnpm test` (unit) and relevant smoke tests between each wave to avoid large-bang rewrites.

## Regression Testing Strategy
- Package tests (`packages/auth/tests/authenticateRequest.test.ts`) assert success/forbidden/unauthorized flows to guard against regressions in JWKS parsing, role enforcement, and metrics events.
- Service-level suites should stub `metrics.recordSecurityEvent` and validate that the shared helper is invoked with the expected role sets whenever new routes adopt it.
- Before removing legacy guards, execute `pnpm test` and targeted smoke tests (e.g., `pnpm --filter @apgms/api-gateway test`) after each incremental adoption step to ensure no regression escapes.
