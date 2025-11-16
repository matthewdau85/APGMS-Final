# Stakeholder Connectivity & First-Run Instructions

This guide shows how to wire the APGMS prototype to an external banking/ATO stakeholder, which environment variables to customize, and what documentation/evidence to capture on first run.

## Prototype run (local developer + sandbox partner)

1. **Environment setup**
   * Set `DESIGNATED_BANKING_URL` to the partner/sandbox API base (e.g., `https://sandbox-bank.example.com`).
   * Supply `DESIGNATED_BANKING_TOKEN` and `DESIGNATED_BANKING_CERT_FINGERPRINT` if the partner requires bearer auth or certificate pinning.
   * Add `DSP_PRODUCT_ID` to record the ATO DSP reference you’re using for the pilot.
2. **Initial startup**
   * Start the gateway and call `/compliance/status`; it will write `artifacts/compliance/partner-info.json` with partner metadata.
   * Issue pilot workloads: POST payroll/POS payloads to `/ingest/payroll` and `/ingest/pos` with unique `Idempotency-Key` headers.
   * Execute `/compliance/precheck`, resolve any alerts through `/compliance/alerts/:id/resolve`, and finally POST to `/compliance/transfer`.
   * After the transfer, a pilot report (`artifacts/compliance/pilot-report-<timestamp>.json`) captures transfers, reminders, and alerts; send this file to your stakeholder for evidence.

## Production run (stakeholder-ready deployment)

1. **Stakeholder connection**
   * Obtain the partner-approved `DESIGNATED_BANKING_URL`, token, and cert fingerprint from the contractual agreement.
   * Fill `DSP_PRODUCT_ID` with the ATO-registered product identifier used for the deployment.
   * Ensure the FS repository includes the signed OSF questionnaire, AUSTRAC/ASIC/AFSL documents, and any pilot summaries in `artifacts/compliance/`.
2. **Customization**
   * Update `docs/runbooks/admin-controls.md` to reflect the formal status (application dates, product IDs, partner contact).
   * Use the `/compliance/status` and `/compliance/reminders` endpoints to populate dashboards that show buffer tiers plus upcoming BAS deadlines before each lodgment.
   * Share the pilot report JSON plus partner metadata file with compliance/security stakeholders; they can now verify the wallet balance, tier status, and shortfall alerts triggered during the last pilot.

## Maintenance & evidence

- Keep each pilot’s JSON output and partner metadata file inside `artifacts/compliance/`; auditors can use them to verify that the vertical slice (ingest → ledger → precheck → transfer → alert) actually produced a transfer ID.
- Document any change to the partner URL/token or DSP product ID in this file and the OPS runbook so future runs continue to operate under the correct legal composite.
