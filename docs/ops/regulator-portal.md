# Regulator Portal Operations

## Purpose
- Read-only surface for Treasury / ATO sandbox reviewers.
- Authenticated via short-lived access code, issues dedicated JWT audience (`REGULATOR_JWT_AUDIENCE`).
- All requests recorded via `recordAuditLog` with action prefix `regulator.*` and chained hashes.

## Login Flow
1. POST `/regulator/login` with `{ accessCode, orgId }`.
2. Access code lives in `REGULATOR_ACCESS_CODE` secret; rotate via secret manager and restart gateway.
3. Successful login issues JWT + session token stored in `RegulatorSession` table with TTL (`REGULATOR_SESSION_TTL_MINUTES`).
4. Session guard (`createAuthGuard`) checks expiry on every `/regulator/*` hit; expired sessions return 401.

## Portal Pages (webapp)
- **Overview**: Calls `/regulator/compliance/report`, `/regulator/alerts`, `/regulator/monitoring/snapshots`, `/regulator/bank-lines/summary`.
- **Evidence Library**: GET `/regulator/evidence` (list) + `/regulator/evidence/:id` (detail). UI can re-hash payload client-side to prove tamper-evidence.
- **Monitoring**: Lists recent snapshots (`/regulator/monitoring/snapshots`) and renders raw payload JSON for export.

## Connectors automation
- Use `/connectors/capture/payroll` or `/connectors/capture/pos` to inject PAYGW/GST captures for an org while authenticated as an admin; include `{ orgId, amount }` in the body.
- Connectors responses include the transfer metadata plus the reconciliation artifact (`artifactId`, `sha256`, `summary`) that the regulator evidence endpoints surface.
- These endpoints exercise the designated-account policy, generate alerts if policy violations occur, and feed the regulator portal so `compliance/report` reflects the most recent totals.

## Health & Monitoring
- `/regulator/health` is a dedicated probe target (mirrors `/health` but tagged for regulator metrics).
- Metrics captured through default Prometheus handler with `route="/regulator/..."` labels; add Grafana panel filtered by that prefix to watch regulator usage separately.
- Scheduled smoke (`pnpm smoke:regulator`) hits login + critical read endpoints; wire into nightly job or on-demand when rotating credentials.

## Audit & Evidence
- Each regulator action writes to `auditLog` table with hash chaining (`hash` + `prevHash` columns).
- Evidence payloads stored in `EvidenceArtifact.payload` (JSON) and `wormUri` (immutable store reference). SHA-256 digest persisted for external verification.
- For regulator exports, instruct reviewers to download from Evidence Library UI or hit `/regulator/evidence/:id` via script.

## Troubleshooting
- **401 on portal**: verify access code rotation, session TTL, and `REGULATOR_JWT_AUDIENCE` match between API + webapp env.
- **Hash mismatch**: confirm payload JSON matches the stored artifact (no whitespace trimming), recompute via `node -e "console.log(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'))"`.
- **Missing snapshots**: run `pnpm compliance:evidence` or trigger `createMonitoringSnapshot` via `/compliance/evidence` generation to seed new entries.

## Change Control
- Any update that touches `/regulator/*` endpoints requires audit note in change request.
- Document new artifacts or schema changes in `docs/ops/runbook.md` and update `scripts/regulator-smoke.mjs` accordingly.
