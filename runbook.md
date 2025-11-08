# Compliance Evidence Runbook

This runbook explains how to produce auditable evidence for the compliance
controls mapped in `docs/compliance/control-maps.md`.

## Before you start

1. Ensure the API gateway and worker services are running locally or in the
   target environment.
2. Export environment variables required by the smoke suite (see
   `services/api-gateway/test/run.ts`).
3. Install dependencies with `pnpm install` at the repo root.

## Evidence capture workflow

1. **Link validation**
   - Run `pnpm lint:markdown` to confirm all Markdown files (including new SOPs)
     pass lint checks.
   - For docs with external references, run
     `pnpm exec markdown-link-check docs/**/*.md` if outbound HTTP is allowed.
2. **Control verification**
   - Execute the Fastify test suite covering security controls:
     `pnpm --filter services/api-gateway test -- --test-name-pattern "security\|auth\|pii\|designated"`.
   - Run `pnpm smoke:regulator` to prove regulator guard rails and evidence
     endpoints respond with audit logging.
3. **Capture artifacts**
   - Copy the console output of each command into
     `artifacts/compliance/<release>.md`.
   - Attach regulator portal screenshots (Overview, Evidence, Monitoring)
     confirming WORM evidence availability.
4. **Update status**
   - Summarise results in `status/README.md`, referencing the evidence artifact
     and noting any outstanding remediation items.
5. **Review SOPs**
   - Validate that onboarding/offboarding actions follow
     `docs/compliance/regulator-sop.md`.
   - Confirm retention actions are logged per
     `docs/compliance/retention-worm-sop.md`.

## Escalation path

- **Security Lead** – Owns ASVS alignment and regulator guard rails.
- **Privacy Officer** – Oversees DPIA, TFN handling, and retention sign-off.
- **Ops Lead** – Maintains evidence jobs (`pnpm compliance:evidence`) and status
  site updates.

Document all escalations in the incident or change ticket to preserve audit
history.
