# Setup Wizard, PayTo, and Compliance Task Backlog

The following backlog breaks down the remaining work to reach roughly 85% readiness on the onboarding pillars and deliver the new setup wizard. Each task records its rationale and the concrete acceptance criteria needed for sign-off.

## A. Setup Wizard & Onboarding Flow

**Primary owners:** WebApp squad (apps/webapp, services/onboarding)

**Related code paths to review before kicking off:**
- `webapp/src/routes/onboarding/**/*` for existing welcome flow scaffolding.
- `services/onboarding/*` for REST handlers that will back the wizard.
- `packages/payments-api/src/designatedAccount.ts` for the one-way account APIs that need to be orchestrated.

| Task | Description & Rationale | Acceptance Criteria |
| --- | --- | --- |
| **A1. Build a multi-step setup wizard in the web app** | Implement a guided onboarding flow that: (1) collects organisation details (name, ABN, TFN), (2) verifies ABN/TFN via an ATO/ABR lookup API, (3) retrieves registered tax obligations (PAYGI, PAYGW, GST) and (4) enforces setup of one-way accounts for each obligation. | Wizard enforces completion of all steps. ABN/TFN lookup uses a stub or sandboxed API. If obligations include PAYGW and GST, the wizard surfaces mandatory fields. Form validation ensures required fields are populated. |
| **A2. Integrate ABN/TFN lookup** | Choose or stub an ABR API or ATO service to validate the ABN/TFN and fetch the entity’s tax registrations. Provide fallback/mock data for local testing. | API integration returns registration status for PAYGI, PAYGW and GST. Wizard uses these statuses to preselect obligations. Error handling displays meaningful messages for invalid ABNs/TFNs. |
| **A3. Create designated accounts & PayTo agreements via wizard** | During the wizard, call a new payments API to create designated accounts and initiate PayTo agreements. Prompt users to authorise the PayTo mandate. Include logic to retry or poll until the bank confirms the mandate. | After completion, each obligation (PAYGW, GST, PAYGI) has a designated account ID and a PayTo mandate ID. Audit logs record creation events. |
| **A4. Enforce mandatory configuration for registered obligations** | If the ABN/TFN lookup shows the business is registered for PAYGW, GST or PAYGI, make the corresponding setup steps compulsory. Warn and prevent completion if a registered obligation is skipped. | Wizard cannot be completed unless all obligations flagged by the ATO lookup are configured. Unit tests cover skipping logic and error messages. |
| **A5. Save and resume onboarding state** | Store intermediate wizard state in the database so users can resume later. Allow partial completion of non-mandatory steps (e.g., optional email or phone numbers). | Users can return to the wizard and continue from the last completed step. Incomplete mandatory steps prevent access to the main dashboard. |

## B. Core Functionality & PayTo Enforcement

**Primary owners:** Payments platform squad (packages/payments-*, services/payments)

**Key integration surfaces:**
- `packages/payments-api/src/payto` (new) for the `PayToService` interface and sandbox adapters.
- `services/organisations/handlers.ts` for the automatic designated account provisioning logic.
- `worker/reconciliation/*` for the PAYGI report expansion.

| Task | Description & Rationale | Acceptance Criteria |
| --- | --- | --- |
| **B1. Implement PayTo agreements** | Design a `PayToService` interface in the payments package with methods to create and verify mandates. Integrate with a selected bank or a sandbox PayTo API. | `createPayToMandate` returns a mandate ID and status. The designated account API stores the mandate reference. The API prevents withdrawals unless a mandate is active. |
| **B2. Create designated accounts for each obligation** | Modify the organisation creation flow to automatically create separate designated accounts for PAYGI, PAYGW and GST. Enforce a naming convention and store the account type ("PAYGI", "PAYGW", "GST"). | When a new organisation is onboarded, the database contains three designated accounts with zero balance and no transactions. |
| **B3. Update reconciliation logic to include PAYGI** | Extend `generateDesignatedAccountReconciliationArtifact` to include PAYGI balances and inflows. Adjust the totals calculation to sum PAYGI separately (PAYGW, GST and PAYGI). | Reconciliation summary output includes PAYGI totals. Tests ensure the totals for PAYGI, PAYGW and GST add up correctly. |

## C. Security & Compliance Enhancements

**Primary owners:** Security & SRE squad (infra/secrets, services/shared/config)

**Artifacts / references:**
- `infra/terraform` for vault/secret manager configuration files.
- `runbooks/security.md` and `docs/compliance/*` for OSF/STP evidence capture.
- `packages/common-http/src/retry.ts` for the shared retry helpers that can be wrapped in the circuit breaker implementation.

| Task | Description & Rationale | Acceptance Criteria |
| --- | --- | --- |
| **C1. Add secret vault integration** | Migrate sensitive keys (banking API keys, encryption keys) to a secure vault (e.g., AWS Secrets Manager). Update configuration to fetch secrets at runtime instead of reading from `.env`. | No secrets remain in plain-text `.env` files. Secrets load correctly in development and production. |
| **C2. Implement retry and circuit breaker wrappers** | Wrap external banking API calls and ATO/ABR lookups with configurable retries and circuit breakers. Provide fallback responses or queuing when downstream services are unavailable. | Calls to external APIs use retry logic with exponential backoff. Circuit breaker triggers after repeated failures and logs the outage. Tests simulate transient failures and ensure the system continues processing. |
| **C3. Draft OSF and STP submission evidence** | Continue preparing the OSF security questionnaire draft and gather evidence (audit logs, encryption policies). Create an initial STP payload generator for PAYGW data so the team can begin mapping fields. | Draft OSF questionnaire file exists and lists all security controls. A sample STP payload is generated from one organisation’s PAYGW data. |

## D. Forecasting & Innovation

**Primary owners:** Data & Forecasting squad (services/forecasting, worker/forecasting)

**Implementation tips:**
- `services/forecasting/src/model.ts` currently exports the EWMA baseline – extend it with calibration inputs.
- `apps/api/src/routes/forecast.ts` should expose the `/forecast` endpoint once the service layer is updated.

| Task | Description & Rationale | Acceptance Criteria |
| --- | --- | --- |
| **D1. Implement basic ML calibration** | Use synthetic or pilot data to calibrate the existing EWMA/regression model, producing more realistic forecasts. Expose an API endpoint `/forecast` returning predicted PAYGI, PAYGW, GST obligations and their tiers. | Endpoint returns non-zero forecasts with ±20% accuracy on sample data. Unit tests verify output structure. |
| **D2. Add configuration for alert thresholds** | Allow organisations to configure the percentage shortfall that triggers a tier escalation alert. This lets users tune sensitivity to forecast errors. | Organisations can set a numeric threshold (default 10%). Alerts respect this threshold. Tests verify that lower thresholds increase alerts. |

## E. Documentation & Onboarding Material

**Primary owners:** Developer Experience squad (docs/, runbooks/, webapp content team)

**Documentation cross-links to keep updated:**
- `runbooks/README.md` index, so the new setup wizard doc is discoverable.
- `docs/environments/*` so the real/prototype guides appear alongside the existing quickstarts.
- `webapp/public/privacy.html` to surface the ABN/TFN statement through the UI.

| Task | Description & Rationale | Acceptance Criteria |
| --- | --- | --- |
| **E1. Update runbooks with wizard and PayTo setup** | Document how to run the setup wizard locally and in staging. Include instructions for configuring the ABN/TFN lookup stub or API, setting up PayTo providers and granting required scopes. | `docs/setup-wizard.md` details each step of the wizard, required environment variables and troubleshooting. |
| **E2. Real/prototype environment guides** | Enhance the existing quickstart to explain running the real banking integration vs. the prototype (mock bank). Provide steps to spin up a local PayTo sandbox and the ABN/TFN lookup stub. | Two guides (`real-app.md` and `prototype.md`) exist. Following them produces a working environment with the setup wizard accessible via the web app. |
| **E3. ABN/TFN data privacy statement** | Draft a privacy statement explaining how ABN/TFN data is used and stored, in line with Australian privacy laws. | Statement published in `docs/privacy.md`, referenced in onboarding and accessible via the UI. |
