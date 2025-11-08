# Regulator Onboarding & Offboarding SOP

Follow this SOP when granting or revoking regulator workspace access. It aligns
with DSP 6.2 and TFN 11 controls and references the artefacts auditors expect.

## Prerequisites

- Confirm the requesting regulator entity is recorded in the customer contract
  register.
- Ensure `REGULATOR_ACCESS_CODE`, `REGULATOR_JWT_AUDIENCE`, and
  `REGULATOR_SESSION_TTL_MINUTES` are set in the deployment environment
  (`services/api-gateway/src/config.ts`).
- Validate the regulator portal is healthy via `pnpm smoke:regulator` or the
  `/regulator/health` probe.

## Onboarding steps

1. **Authorise the request**
   - Validate written approval from the customer executive or regulator MoU
     referencing the access scope.
   - Record the approval in the change log with ticket ID and expiry date.
2. **Issue credentials**
   - Generate a unique access code and update the environment secret store
     (HashiCorp Vault entry `regulator/access_code`).
   - Rotate the JWT audience if granting access to a new regulator jurisdiction;
     update infrastructure variables accordingly.
3. **Create regulator session**
   - Run `pnpm smoke:regulator` to ensure login succeeds and evidence endpoints
     respond. Archive the console output under `artifacts/compliance/<release>.md`.
   - Capture screenshots of the regulator portal (Overview, Evidence, Monitoring)
     and attach to the onboarding ticket.
4. **Notify stakeholders**
   - Share the access code out-of-band with the regulator contact.
   - Update `status/README.md` with the regulator onboarding date and evidence
     references.
5. **Monitor first login**
   - Watch for `regulator.login` and `regulator.monitoring.list` audit entries via
     the observability dashboards.

## Offboarding steps

1. **Trigger** – Receive written notice that access is no longer required or
   detect inactivity beyond the agreed SLA.
2. **Revoke credentials**
   - Run the `revokeRegulatorSession` script or execute
     `DELETE FROM "RegulatorSession" WHERE "regulatorId" = <id>;` via the admin
     console.
   - Rotate `REGULATOR_ACCESS_CODE` and `REGULATOR_JWT_AUDIENCE` secrets
     immediately after revocation.
3. **Evidence clean-up**
   - Export the regulator audit trail for the final review and store under
     `artifacts/compliance/<release>.md`.
   - Update the regulator roster spreadsheet and ticketing record.
4. **Status update**
   - Amend `status/README.md` with the offboarding date.
   - Confirm dashboards no longer show active regulator sessions.

## Verification checklist

- [ ] `pnpm smoke:regulator` passes within the deployment environment.
- [ ] `services/api-gateway/src/app.ts` audit logs show `regulator.*` actions tied
      to the new or revoked session.
- [ ] Access code rotation documented in the change management system.
- [ ] `status/README.md` updated with onboarding/offboarding evidence links.
