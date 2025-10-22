# Secrets Management

This document summarizes where security-sensitive configuration values are stored and who is
responsible for rotating them.

## Where secrets live

- **Local development** – Developers should copy `.env.example` to `.env` and fill in the
  environment-specific values. The `.env` file is git-ignored and should never be committed.
- **Continuous integration** – Secrets required by pipelines are stored in the CI provider's
  encrypted secret store (e.g., GitHub Actions repository or organization secrets). Access is
  restricted to the security and platform teams.
- **Shared staging/production environments** – Runtime secrets live in the managed secret
  managers for each environment (e.g., AWS Secrets Manager or parameter store) and are injected at
  deploy time via infrastructure automation.

## Rotation cadence and owners

- **Application authentication material (JWT keys, client secrets, signing certs)**
  - *Owner*: Security engineering
  - *Cadence*: Rotate at least every 90 days or immediately upon suspected compromise.
- **Third-party integration credentials (APIs, webhooks)**
  - *Owner*: Platform engineering
  - *Cadence*: Rotate every 180 days or when vendors require regeneration.
- **Infrastructure access tokens (CI deploy keys, cloud IAM users)**
  - *Owner*: DevOps
  - *Cadence*: Rotate quarterly and audit access monthly.

All rotations must be recorded in the shared change log and communicated to affected teams at
least one business day in advance whenever possible.
