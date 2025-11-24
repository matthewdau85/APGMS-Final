# APGMS Compliance And Patent Mapping (Australia Only)

## Overview

The Automated PAYGW & GST Management System (APGMS) is implemented as an
Australia-only platform that automates real-time securing of PAYGW and GST
liabilities into designated one-way accounts, and then supports accurate BAS
lodgment, shortfall management, payment plans, and evidence capture for the
Australian Taxation Office (ATO).

The core scope is:

- Australian BAS only.
- Australian PAYGW and GST only (with extension points for PAYGI, FBT, and company tax).
- Designated one-way accounts for PAYGW and GST to prevent misuse of tax funds.
- Central, versioned Australian tax configuration tables (no hard-coded rates).
- Full compliance trail and regulator views for ATO users.

All organisations in the system are treated as Australian entities and all tax
logic, tests, and integrations are aligned with ATO rules and processes.

## Patent Feature Mapping

### 1. One-Way Designated Accounts

**Patent feature**

- Dedicated, one-way designated accounts for PAYGW and GST.
- Deposit-only semantics enforced at the application level.
- Lifecycle management (activation, sunset, closure).

**Implementation**

- Prisma model for designated tax accounts tied to `Org` and `TaxType`.
- Application logic enforces:
  - No withdrawals from designated accounts.
  - At most one ACTIVE designated account per `(orgId, taxType)`.
  - Lifecycle transitions from activation through to closure.
- API routes expose:
  - Creation, activation, sunset, and closure of designated accounts.
  - Validation endpoints to confirm account configuration before use.

### 2. Real-Time PAYGW and GST Securing

**Patent feature**

- Continuous securing of PAYGW and GST into designated accounts based on:
  - STP (Single Touch Payroll) data for PAYGW.
  - POS/transaction feeds for GST.
- Final remittance at BAS lodgment only.

**Implementation**

- Prisma models for PAYGW and GST obligations tied to:
  - Payroll/STP events (PAYGW).
  - Transaction feeds (GST).
- Domain engines:
  - `calculatePaygwObligation` uses tax parameter sets and rate schedules.
  - `calculateGstObligation` computes net GST for a BAS period.
- `BasCycle` tracks:
  - Required vs secured PAYGW and GST.
  - JSON breakdowns for audit and ATO evidence.

### 3. BAS Lodgment And Remittance

**Patent feature**

- Lodgment of Australian BAS periods with correct PAYGW and GST totals.
- Shortfall detection and refund BAS handling.

**Implementation**

- `BasCycle` state machine:
  - `DRAFT` → `READY` → `LODGED` / `REFUND_DUE`, with `SHORTFALL` when under-secured.
- Lodgment logic:
  - Uses tax engines and configuration tables only (no hard-coded rates).
  - Records lodgment metadata and outcomes.
- Connectors:
  - Adapter for ATO BAS lodgment (e.g. via SBR).
  - Evidence artifacts linking to statements and confirmations.

### 4. Shortfall Detection And Alerts

**Patent feature**

- Pre-lodgment shortfall detection.
- Alerts/monitoring snapshots for regulator oversight.

**Implementation**

- `Alert` and `MonitoringSnapshot` models for:
  - Shortfall warnings.
  - Designated account imbalance.
  - Other AU risk signals.
- Regulator routes:
  - `/regulator/compliance/report`
  - `/regulator/alerts`
  - `/regulator/monitoring/snapshots`
- Dashboard surfaces:
  - BAS coverage, secured ratios, and risk bands.

### 5. Payment Plans, Remissions, And Evidence

**Patent feature**

- Structured payment plans for BAS-related debts.
- GIC/penalty modelling and remission workflows.
- Rich evidence trail for hardship and compliance.

**Implementation**

- Models:
  - `PaymentPlanSchedule`, `PaymentPlanInstalment`.
  - `PenaltyEvent`, `RemissionRequest`.
  - `EvidenceArtifact` for bank statements, STP snapshots, ATO account statements, etc.
- Domain logic:
  - Generates schedules and updates statuses.
  - Tracks GIC and penalty events.
- Endpoints:
  - `/payment-plans/*` for plan creation and review.
  - `/regulator/evidence/*` for regulator-facing evidence views.

### 6. AU Tax Configuration Tables

**Patent feature**

- Central, versioned Australian tax configuration.
- No hard-coded PAYGW, GST, HELP/STSL, or other rates in code.

**Implementation**

- Tax configuration models (parameter sets and rate schedules) with:
  - `TaxType`, effective dates, and JSON parameters.
  - Bracketed rate schedules for PAYGW.
- Rule-update worker:
  - Validates non-overlapping periods per tax type.
  - Logs changes for audit.

### 7. Regulator Views, Risk Scoring, And Projections

**Patent feature**

- Regulator-level view of risk and projected impact on collectable debt.

**Implementation**

- Regulator domain module computes:
  - Per-org compliance reports and risk scores.
  - Macro-level simulations of reduced collectable debt with APGMS adoption.
- Routes:
  - `/regulator/compliance/report`
  - `/regulator/simulations/debt-reduction`

## Security And Privacy (ATO/DSP Context)

- Helmet-based CSP, HSTS, referrer policy, and frameguard.
- AES-256-GCM envelope encryption for PII and account identifiers.
- Key management via environment/KMS-backed providers.
- Logging with redaction for TFN, ABN, BSB, account numbers, and auth headers.
- Idempotency records and audit logs for all mutating operations.

## Scope And Extensibility

The system is intentionally constrained to **Australia and the ATO**:

- All tax logic is AU-only and tied to ATO rules.
- Future extensions (PAYGI, FBT, company tax) stay within AU scope.
- No multi-country regime support; any `regime` fields are treated as AU.
