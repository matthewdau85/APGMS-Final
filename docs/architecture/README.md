# Platform architecture overview

The APGMS platform is composed of modular services that expose financing workflows,
compliance automation, and reporting surfaces for institutional customers. The diagram
below captures the core components deployed in production.

## High-level system components

- **Web application (`webapp/`)** – React single-page application served via CloudFront with
  SSR disabled. Provides the Pro+ workspace, portfolio dashboards, bank line workflow, and
  accessibility status hub with live telemetry widgets.
- **API Gateway (`services/api-gateway`)** – Fastify service responsible for authentication,
  bank-line CRUD operations, administrative exports, and idempotent write patterns.
- **Worker tier (`worker/`)** – Node workers orchestrated through AWS EventBridge. Handles
  scheduled jobs such as nightly TFN retention sweeps, compliance evidence snapshots, and
  predictive compliance drift scoring.
- **Shared package (`shared/`)** – Prisma client, masking utilities, and reusable domain logic
  shared across services. Compiled as an internal npm package.
- **Data stores** – PostgreSQL for transactional data, S3 for partner exports and evidence
  archives, OpenSearch for audit logs, and Snowflake for analytics plus the compliance data warehouse.

## Request flow

1. User authenticates via the web application, which exchanges credentials for a signed JWT.
2. The SPA issues API calls to the API Gateway. The gateway validates the JWT, applies
   per-tenant rate limits, and logs the request with PII masking.
3. Mutating requests (e.g., creating bank lines) use Prisma transactions and optional
   idempotency keys to guard against retries from flaky networks.
4. Events written to the `org_tombstone` table trigger a worker job that publishes deletion
   confirmations to regulators, updates the evidence index, and appends audit trails to the
   Snowflake warehouse for partner transparency.

## Cross-cutting concerns

- **Observability** – All services emit structured logs with correlation IDs. Metrics are
  scraped by Prometheus and visualised in Grafana and Tableau. Alerting thresholds are
  documented in `runbooks/ndb.md` and the reliability playbooks, and anomaly detection jobs feed
  the compliance drift model.
- **Security** – Secrets are stored in AWS Secrets Manager. Services rely on AWS IAM roles
  rather than long-lived credentials. The TFN SOP dictates masking requirements for TFN data,
  and OPA policies enforce least-privilege guardrails during deployments.
- **Compliance evidence** – Workers push daily snapshots of control evidence to the GRC vault,
  update `docs/dsp-osf/evidence-index.md` when new artefacts are produced, and broadcast
  anonymised KPIs to the Snowflake partner share.

## Deployment pipeline

1. Developers open pull requests that trigger linting, unit tests, Playwright accessibility
   checks, and infrastructure validation.
2. A merge to `main` builds container images via GitHub Actions, runs policy-as-code checks,
   and pushes to ECR.
3. Terraform (`infra/iac`) applies environment-specific configuration, then rolling deploys
   services onto ECS with blue/green traffic shifting.
4. Post-deploy smoke tests verify `/ready` on the API gateway, load the SPA home route, and
   execute accessibility and TFN evidence validation probes.

## Future enhancements

- Add streaming ingestion for partner bank line feeds to reduce manual data entry (in progress).
- Expand the status site to display compliance control freshness sourced from the evidence index (shipped).
- Introduce automated WCAG regression dashboards surfaced alongside product analytics (shipped).
- Implement zero-trust service mesh with mutual TLS and automated posture reporting (planned).

