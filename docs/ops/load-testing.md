# Load & Monitoring Validation

Use the existing Prometheus metrics plus targeted synthetic traffic to verify that the APGMS observability pipeline holds under real work loads (BAS lodgment → transfer → ATO reporting → monitoring).

1. **Install dependencies**

   ```bash
   pnpm install --frozen-lockfile
   pnpm exec playwright install --with-deps  # already invoked by CI
   pnpm exec k6 version
   ```

2. **Run the k6 smoke/load scenario**

   Use the existing `k6/smoke.js` and extend it as needed:

   ```bash
   pnpm k6:smoke --env BASE_URL=http://localhost:3000
   ```

   For more targeted validation, create a supplemental script (e.g., `k6/load.js`) that hits the new BAS/transfer/ATO/monitoring endpoints once you have a working auth token and MFA code (see `BAS_MFA_CODE` env). The script can batch:

   * Authenticated POSTs to `/bas/lodgment` and `/bas/transfer`.
   * POST `/ato/report` with real compliance payloads.
   * GET `/monitor/compliance` and `/monitor/risk` to verify snapshots.

   Keep the header/auth handling consistent with the fastify guards; use the same bearer token as your integration tests.

3. **Observe metrics**

   Use `http://localhost:3000/metrics` to ensure counters increment (`apgms_bas_lodgments_total`, `apgms_transfer_instruction_total`, `apgms_ato_reports_total`, `apgms_risk_events_total`). Build Grafana panels:

   * BAS lodgment success rate gauge (`apgms_bas_lodgments_total{status="success"}` vs `status="failed"`).
   * Transfer queue/dequeue trend (`apgms_transfer_instructions_total`, `apgms_transfer_execution_total`).
   * Payment-plan spike alert (`apgms_payment_plan_requests_total` > 0 within 1h).
   * Risk burst alert on `apgms_risk_events_total{severity="high"}`.

4. **Alert thresholds**

   Configure alerts (Prometheus rules or Grafana) for:

   * High anomaly score (`apgms_integration_anomaly_score{severity="high"}`) sustained > 5m.
   * BAS lodgment failures > 5%; use `apgms_bas_lodgments_total` rate.
   * Transfer instructions pending > 3 without send events.

5. **Document results**

  Capture the run output/metrics screenshot in `artifacts/monitoring/<timestamp>/` and link it from the release ticket.

6. **Automate compliance snapshot evidence**

   Run `node scripts/collect-monitoring-evidence.mjs` (requires `APGMS_MONITORING_TOKEN` pointing to a valid test session); it hits `/monitor/compliance` and `/monitor/risk` to capture JSON snapshots under `artifacts/monitoring/<timestamp>/`. Attach those files to the release artefact alongside the k6 output.
