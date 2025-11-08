# BAS Verifier & Discrepancy Evidence

Phase 5.5 introduces an automated BAS verifier that blocks remittance when
withheld PAYGW or GST does not match the expected obligations. The verifier is
designed to satisfy patent controls across Security & Privacy, Reliability, and
Compliance by ensuring:

- **Trusted data inputs** – Payroll summaries and POS events are ingested via
  typed provider adapters (`providers/stp/*`, `providers/pos/*`) and persisted
  through Prisma models declared in `shared/prisma/schema.prisma`.
- **Deterministic verification** – `domain/bas/verifier.ts` reconciles the
  designated balance against expected tax for the active BAS cycle.
- **Regulator-ready evidence** – Mismatches produce a JSON + PDF discrepancy
  report that is hashed, logged, and exposed to portal users.

## Data ingestion overview

### STP payroll summaries

1. **Adapters** – `providers/stp/` implements provider-specific mappers that
   normalise STP payloads (gross wages, PAYGW, super, run dates) into the shared
   `StpPayrollSummary` shape.
2. **Persistence** – Summaries land in Prisma models via
   `providers/stp/service.ts`. Each row is tied to an organisation and payroll
   run, and includes the designated allocation recorded at the time of capture.
3. **Usage** – The verifier consumes these records to compute expected PAYGW for
   the BAS period. Wiring the ingestion flow (e.g. worker job or API endpoint)
   remains a follow-up task.

### POS GST events

1. **Adapters** – `providers/pos/` exposes a similar adapter surface for POS
   systems, mapping gross / GST amounts into a `PosGstEvent` shape.
2. **Persistence** – GST events are stored through Prisma models with links to
   receipts or settlement batches.
3. **Usage** – The verifier aggregates GST credits/debits for the BAS window to
   determine the expected GST payable or refundable amount.

## Verification workflow

1. **Trigger** – The API gateway calls
   `domain/bas/verifier.ts#verifyDesignatedBalances` when preparing BAS
   obligations (see `services/api-gateway/src/app.ts`).
2. **Computation** – The verifier loads STP and POS totals for the relevant BAS
   cycle, compares them to the designated PAYGW/GST balances, and produces a
   structured result (`expected`, `designated`, `discrepancies`).
3. **Blocking behaviour** – If any discrepancy exceeds tolerance, the verifier:
   - Marks the BAS flow as blocked (`domain/bas/verifier.ts` sets blockers).
   - Emits a HIGH severity alert with supporting metadata.
   - Generates an evidence artifact containing JSON + PDF representations.

## Discrepancy evidence

- **Artifacts** – Evidence is stored as `bas.discrepancy` artifacts (PDF + JSON)
  with SHA-256 hashes and WORM URIs. Artifact creation lives in
  `domain/bas/verifier.ts#createBasDiscrepancyArtifact`.
- **Report contents** – Reports include totals, per-tax deltas, remediation
  guidance, and encoded PDF data (base64). Both JSON and PDF are hashed so
  regulators can independently verify integrity.
- **Portal access** –
  - **Org portal**: `webapp/src/BasPage.tsx` surfaces discrepancies, blocks
    lodgment, and allows downloading the PDF/JSON evidence via the
    `/compliance/bas/discrepancy-report` API route.
  - **Regulator portal**: `webapp/src/RegulatorOverviewPage.tsx` renders the
    latest report metadata after the compliance timeline and provides direct
    downloads using the `/regulator/bas/discrepancy-report` route.

## Operational guidance

1. **Run ingestion** – Schedule or trigger ingestion jobs that call the STP/POS
   provider services with authenticated payloads. Persisted data should cover
   the full BAS cycle window (monthly or quarterly).
2. **Monitor alerts** – HIGH severity alerts (`BAS_DISCREPANCY_DETECTED`) signal
   that remittance is blocked. Investigate by reviewing the discrepancy report
   and remediation steps logged in the artifact payload.
3. **Regulator review** – Regulator users can export the evidence pack (PDF +
   JSON) for auditing. Hash values in the UI should match those stored in the
   artifact record.
4. **Testing** – Add route/worker tests that cover matched vs mismatched
   scenarios, ensuring the verifier returns expected blockers and that evidence
   is generated exactly once per mismatch.

## Future enhancements

- Wire provider ingestion into a background worker with retry + alerting.
- Extend verifier tolerances (e.g. allow rounding buffers) once policy is set.
- Automate regulator notifications when new discrepancy artifacts are recorded.
