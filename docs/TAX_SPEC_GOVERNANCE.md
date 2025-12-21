# APGMS — Tax Specification Governance

## Purpose

This document defines how tax specifications (“tax specs”) are managed within APGMS.

The goal is to ensure tax rule changes are:
- boring
- reviewable
- safe
- auditable

---

## Roles

### Spec Author

- Drafts or updates tax specifications
- Provides rationale and references
- Does not activate specs

---

### Reviewer

- Reviews specs for correctness and completeness
- Confirms internal consistency
- Verifies effective dates and scope

---

### Approver

- Grants final approval for activation
- Confirms governance requirements are met
- Authorises scheduling

Activation without an approver is forbidden.

---

## Tax Spec Requirements

Every tax specification **must include**:

- **Version**
  - Immutable identifier
  - Uniquely identifies the spec

- **Effective Date**
  - Date from which the spec applies
  - Must be in the future at time of approval

- **Jurisdiction**
  - Explicit jurisdiction (e.g. AU)
  - No implicit applicability

- **Approval Metadata**
  - Approver identity
  - Approval timestamp
  - Reference or rationale

Specs missing any of these fields are invalid.

---

## Activation Rules

- Tax specs **cannot be activated retroactively**
- Activation must be future-dated
- At most one active spec may apply for a given jurisdiction and period

If multiple active specs conflict, computation must halt.

---

## Rollback Policy

Rollback is performed by:
- reactivating a previously approved version

Rollback **never** involves:
- mutating historical specs
- altering past outputs
- rewriting ledger entries

History is immutable.

---

## Tax Spec Lifecycle

All tax specs follow this lifecycle:

