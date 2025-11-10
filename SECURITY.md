# Security Policy

Email: security@yourdomain.example

## Data Protection & Key Management

- All connector credentials and designated account evidence are encrypted using
  envelope encryption (AES-256-GCM) with KMS-backed data keys. The
  implementation lives in `shared/src/security/kms-manager.ts` and is consumed
  by the connectors service (`services/connectors/src/secure-vault.ts`) and the
  designated account reconciliation workflow
  (`domain/policy/designated-accounts.ts`).
- Production deployments load 32-byte master key material from the managed KMS
  (aliases `kms/connector-default` and `kms/designated-artifacts`). The master
  key wraps ephemeral data keys; ciphertext envelopes store the KMS key id so
  key rotations are auditable.
- Development builds fall back to deterministic keys derived from the alias so
  that fixtures and tests remain stable. Rotate the production KMS keys via the
  `pnpm security:rotate-keys` automation and redeploy services to pick up the
  new material.
- Designated account artifacts are sealed before persisting to the
  `EvidenceArtifact` table. API consumers must call the helper
  `decryptDesignatedReconciliationArtifact` to recover plaintext summaries, and
  the SHA-256 digest is still computed on the plaintext for tamper detection.

## MFA & Device Security

- All administrative APIs, including dashboard data, BAS flows, and connector
  operations, require a recent step-up MFA session. The gateway returns HTTP
  428 with `error.code = "mfa_step_up_required"` when the session expires.
- Device risk scoring runs during authentication. New device fingerprints,
  missing user agents, or privileged logins without MFA elevate the risk level
  and surface the signals to the client so security teams can respond quickly.

## Disaster Recovery

- BAS payment failures are queued in the `BasPaymentAttempt` table and retried
  with exponential backoff by the worker job
  (`worker/src/jobs/bas-payment-retry.ts`). Offline submission fallbacks are
  captured and reconciled against the queue to guarantee lodgment.
- Grafana dashboards (`infra/observability/grafana/dashboards.json`) surface
  backlog metrics and emit alerts whenever retries exhaust or offline fallbacks
  accumulate. Follow the runbooks in `docs/ops/runbook.md` and
  `runbooks/ml-operations.md` for incident handling and rollback guidance.
