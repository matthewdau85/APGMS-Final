# APGMS Onboarding API Reference

This folder hosts the OpenAPI specification (`../openapi.yaml`) and the generated TypeDoc output (`./reference/`). Run `pnpm --filter @apgms/api docs` to render the HTML site locally.

## REST Endpoints

### `POST /migrations`
Kick off a payroll/POS migration. Accepts `CreateMigrationRequest` and returns `MigrationResponse`. The request/response schema is documented in both the OpenAPI file and TypeDoc comments in `src/routes/onboarding.ts`.

### `POST /webhooks`
Registers a webhook for migration lifecycle events. Required fields: `url` (HTTPS) and at least one event from `migration.started`, `migration.completed`, or `migration.failed`.

## TypeScript Types

The TypeDoc output includes:

* `OnboardingApiOptions` – plugin configuration for `registerOnboardingApi`.
* Route handlers exported from `onboardingRoutes` for reuse in tests.
* Utility Zod schemas for request validation.

## Tooling Commands

```bash
# Validate OpenAPI spec
pnpm --filter @apgms/api openapi:lint

# Generate HTML docs
pnpm --filter @apgms/api docs
```
