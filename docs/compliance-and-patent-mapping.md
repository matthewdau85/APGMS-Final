# APGMS Compliance and Patent Mapping (Australia Only)

## 1. Scope and Positioning

The Automated PAYGW & GST Management System (APGMS) is an **Australia-only** platform
designed to:

- Secure PAYGW and GST liabilities in real time into **designated one-way accounts**.
- Support accurate and auditable **BAS lodgment**.
- Manage **shortfalls, payment plans and remissions** in line with ATO practice.
- Provide **regulator-grade views** for the Australian Taxation Office (ATO).

Current scope:

- Australian BAS only.
- Australian PAYGW and GST only (with clearly-defined extension points for PAYGI, FBT and
  company tax).
- Australian entities only; multi-jurisdiction logic is out of scope.

All tax logic, tests and integrations are aligned with **ATO legislation, practice
statements and DSP Operational Security Framework (DSP OSF)** expectations.

---

## 2. One-Way Designated Accounts

### Patent-Aligned Feature

- Dedicated **designated accounts** for PAYGW and GST.
- **Deposit-only** semantics enforced at the application layer.
- Lifecycle management from **activation through sunsetting and closure**.

### Implementation

- Domain model in `packages/domain-policy/src/designated-accounts`:
  - `DesignatedAccountType`, `DesignatedAccountLifecycle`,
    `DesignatedAccount` interface.
- Guard logic in `guards.ts`:
  - Rejects non-positive amounts.
  - Forbids movements on `PENDING_ACTIVATION` and `CLOSED` accounts.
  - For `SUNSETTING` accounts, permits deposits only.
  - For all one-way accounts, forbids withdrawals and internal transfers.
- Persistence via Prisma models (not shown in this doc) that tie accounts to:
  - An `Org` (entity).
  - A banking provider account identifier.

This delivers the “designated, one-way account” behaviour described in the patent
without relying on bank-side controls alone.

---

## 3. Real-Time PAYGW and GST Securing

### Patent-Aligned Feature

- Continuous securing of PAYGW and GST into designated accounts based on:
  - **STP / payroll events** for PAYGW.
  - **POS / transaction feeds** for GST.
- Final remittance occurs at **BAS lodgment**, not at the point of sale/payroll.

### Implementation

- PAYGW and GST obligations are persisted as AU-specific domain records tied to:
  - Payroll / STP feeds (PAYGW).
  - Transaction feeds and journal entries (GST).
- The AU tax engine in `packages/domain-policy/src/au-tax` is entirely
  **data-driven**:
  - `TaxParameterSet` and `TaxRateSchedule` tables define rate sets and brackets.
  - `PaygwEngine` resolves the active parameter set by jurisdiction, tax type and
    date, then applies brackets to calculate withholding.
  - A separate GST config maps financial years to a **single rate in basis points**.
- BAS cycle records capture:
  - Required vs secured PAYGW and GST for each BAS period.
  - JSON breakdowns that can be surfaced directly in regulator views.

No PAYGW, GST or HELP/STSL rates are hard-coded in the engine; they are
maintained in versioned configuration tables.

---

## 4. BAS Lodgment and Remittance

### Patent-Aligned Feature

- Correct and traceable lodgment of Australian BAS periods.
- Handling of **shortfalls** and **refund BAS** scenarios.

### Implementation

- A `BasCycle` state machine (domain-level) tracks:
  - Period status: `DRAFT` → `READY` → `LODGED` / `REFUND_DUE`.
  - Coverage ratios (secured vs required PAYGW and GST).
  - Shortfall detection when secured amounts undershoot obligations.
- Lodgment logic:
  - Uses only the AU configuration tables and engines for calculations.
  - Stores lodgment metadata and any ATO reference identifiers.
- Connectors (planned / stubbed):
  - Adapter for ATO BAS lodgment (e.g. via SBR).
  - Storage of ATO confirmations as evidence artefacts.

---

## 5. Shortfall Detection and Alerts

### Patent-Aligned Feature

- Early detection of likely BAS shortfalls.
- Monitoring and alerting for both the business and the regulator.

### Implementation

- Domain models for:
  - `Alert` and `MonitoringSnapshot` (e.g. “PAYGW shortfall projected for this BAS
    period”, “Designated account not funded for X days”).
- Regulator routes (demo / stub level):
  - `/regulator/compliance/report`
  - `/regulator/alerts`
  - `/regulator/monitoring/snapshots`
- Outputs:
  - Per-org shortfall warnings.
  - Coverage ratios and basic risk bands.
  - Aggregated views that can be used for ATO portfolio-level analysis.

---

## 6. Payment Plans, Penalties and Evidence

### Patent-Aligned Feature

- Structured payment plans for BAS-related debts.
- GIC / penalty modelling and remission workflows.
- Rich, auditable evidence trails.

### Implementation

- Domain models:
  - `PaymentPlanSchedule` / `PaymentPlanInstalment` for structured arrangements.
  - `PenaltyEvent` and `RemissionRequest` for GIC/penalty activity.
  - `EvidenceArtifact` for:
    - Bank statements.
    - STP snapshots.
    - ATO account statements and notices.
- APIs:
  - `/payment-plans/*` for creating and updating plans.
  - `/regulator/evidence/*` for ATO-facing evidence views.
- The ledger component provides an immutable journal underpinning
  reconciliations between:
  - Source transactions.
  - Designated accounts.
  - ATO running balance accounts.

---

## 7. AU Tax Configuration Tables

### Patent-Aligned Feature

- Central, versioned Australian tax configuration.
- No hard-coded PAYGW, GST or other rates.

### Implementation

- Prisma models for:
  - `TaxParameterSet` (jurisdiction, tax type, financial year, validity window).
  - `TaxRateSchedule` (brackets for PAYGW, simple rate rows for GST).
- Repository implementation (`PrismaTaxConfigRepository`):
  - Resolves the active parameter set per `(jurisdiction, taxType, date)`.
  - Shapes rows into typed AU config objects (`PaygwConfig`, `GstConfig`).
  - Performs a soft check for overlapping parameter windows (enforced properly by
    migrations and the rule-update worker).
- A rule-update worker (planned / stubbed):
  - Upserts new parameter sets.
  - Validates non-overlapping windows per tax type.
  - Logs changes for audit.

---

## 8. Regulator Views, Risk Scoring and Projections

### Patent-Aligned Feature

- Regulator-level views of risk and projected impact on collectable debt.

### Implementation

- Regulator domain module computes:
  - Per-organisation compliance summaries and risk scores.
  - Simple portfolio-level projections of collectable-debt reduction under
    different APGMS adoption scenarios.
- Routes:
  - `/regulator/compliance/report`
  - `/regulator/simulations/debt-reduction` (planned/demo).

---

## 9. Security and Privacy (ATO / DSP OSF Context)

APGMS is being built as a **DSP-grade product**, not a generic app:

- HTTP security:
  - Fastify with `@fastify/helmet`:
    - CSP with `default-src 'self'`.
    - HSTS (production only).
    - Referrer-Policy, X-Content-Type-Options, X-Frame-Options, etc.
  - Centralised security header configuration in the API gateway.
- Data protection:
  - AES-256-GCM envelope encryption for PII and banking identifiers.
  - Key management via environment/KMS-backed providers.
- Logging and observability:
  - Structured logging with redaction of TFNs, ABNs, BSBs, account numbers and
    authorisation headers.
  - Audit logs for all mutating actions.
- DSP OSF alignment:
  - Strong authentication and authorisation layers.
  - Isolation of production environments and secrets.
  - Support for regulator-only access paths and views.

---

## 10. Extensibility and Limits

The system is **deliberately constrained** to the Australian regime:

- All tax logic and configuration are AU-only and linked to ATO rules.
- Future extensions (PAYGI, FBT, company tax) remain AU-centric.
- No cross-jurisdiction or multi-regime logic is in scope for this codebase.

This narrow scope makes the compliance story clearer for both patent purposes
and ATO DSP OSF assessment.
