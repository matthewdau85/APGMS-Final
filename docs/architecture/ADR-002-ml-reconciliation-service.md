# ADR-002: ML-Assisted Reconciliation Service Boundary

## Status
Proposed – 2025-11-02

## Context
Stakeholder interviews were conducted with:

- **Payments Operations** – needs payroll disbursement mismatches surfaced before the following business day to avoid under/over payments to employees.
- **Compliance & Assurance** – requires BAS evidence artefacts to cite the provenance of every reconciliation decision, including machine-generated ones.
- **Product & Support** – wants clear UI messaging when ML outcomes fall back to deterministic rules so support can explain outcomes to employers.

From these sessions we agreed on two priority ML-assisted reconciliation use-cases and their service-level expectations:

| Use-case | Description | Target Confidence | Latency Budget |
| --- | --- | --- | --- |
| `PAYROLL_TO_BANK` | Match approved payroll runs against banking transactions to confirm disbursement and amount parity. Supports nightly designated account checks. | ≥ 0.92 auto-reconcile precision, ≥ 0.98 recall for alerting unmatched payments. | P95 ≤ 750 ms per case when invoked synchronously by the worker. |
| `BAS_SOURCE_OF_TRUTH` | Suggest ledger vs source document matches (invoices, receipts) that feed BAS evidence artefacts. | ≥ 0.9 precision for suggested matches; confidence score must be returned for manual triage. | P95 ≤ 1.5 s for batch (≤ 50 documents) and ≤ 400 ms for single document lookups from the API gateway. |

Both use-cases require graded confidence thresholds and traceable fallbacks so that deterministic policy checks remain the source of truth when ML output is ambiguous.

## Decision
We will introduce an ML-assisted reconciliation module (`services/recon`) that exposes a gRPC/HTTP API and an internal worker contract. The service boundary is defined as follows:

- **Inbound API (`ReconScoringService`)** – Accepts reconciliation scoring requests from the API gateway (`services/api-gateway`) and scheduled workers (`worker/src/jobs`). Each request declares the use-case, candidate records, and desired latency tier (`SYNC` vs `ASYNC`).
- **Domain/Policy integration** – The `domain/policy` package retains ownership of deterministic rules (e.g., designated account artefacts). Policies call the ML service via the shared TypeScript contracts when higher confidence automation is possible; otherwise they fall back to rules-only execution.
- **Worker interaction** – Nightly jobs enqueue `ReconScoringRequest` payloads. When the ML service returns low confidence, the worker persists a `manual-review` task and continues with the rule-based artefact to ensure compliance deadlines are met.
- **Outputs** – The service responds with scored match sets, per-use-case confidence thresholds, and fallback instructions. Every response includes a trace token so audit logs and BAS evidence can cite the ML decision lineage.

The service will be deployed alongside other stateless services. Model execution is encapsulated behind this boundary so that policy code or workers only depend on typed contracts, not on ML runtime specifics. This keeps the ML lifecycle (feature extraction, model updates) isolated from domain rule changes.

## Consequences
- `services/recon` becomes the single integration point for ML-based reconciliation, preventing policy or worker code from embedding model-specific assumptions.
- Shared TypeScript contracts define request/response schemas, enabling compile-time validation for gateway and worker packages.
- Latency and confidence targets are explicit, allowing SLO dashboards to surface regressions and providing clear fallback rules for compliance-critical workflows.
- Additional use-cases can extend the shared contracts with new enumerations without breaking existing consumers.
- Model retraining can adjust thresholds centrally, with downstream services automatically honouring the updated values.

## Follow-up
- Implement secure service-to-service authentication (mTLS or signed JWT) before exposing the API beyond internal networks.
- Add schema validation (e.g., Zod or TypeBox) so runtime requests can be rejected when they violate the contract.
- Extend observability to emit decision metrics (confidence histograms, fallback counts) for SLO tracking.
