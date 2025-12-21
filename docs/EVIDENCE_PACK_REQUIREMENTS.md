# APGMS — Evidence Pack Requirements

## Purpose

This document defines the minimum requirements for an APGMS evidence pack.

An evidence pack exists to:
- support audit and review
- enable deterministic replay
- demonstrate system integrity

Evidence packs must be **complete, consistent, and reproducible**.

---

## Evidence Pack Completeness Checklist

An evidence pack is considered complete **only if it includes all items below**.

### 1. Input Data Hash

- Cryptographic hash of all input data used
- Allows verification that inputs have not changed
- Input data itself may be referenced or included separately

---

### 2. Tax Specification Identifier and Version

- Unique tax spec ID
- Exact version used for computation
- Jurisdiction and effective date

---

### 3. Computation Timestamp

- Exact timestamp when computation occurred
- Timezone included
- Used to correlate system state and readiness

---

### 4. Output Obligations

- Final computed obligations
- Clearly attributed to period and entity
- Structured and machine-readable

---

### 5. Ledger Entries

- Immutable ledger records produced by the computation
- Includes identifiers and sequence numbers
- Demonstrates accounting integrity

---

### 6. System Version (Git SHA)

- Git commit hash of the running system
- Ensures reproducibility of logic
- Links output to source code state

---

### 7. Readiness Status at Time of Run

- Readiness check outcome at execution time
- Confirms system was healthy when computation occurred

---

## Export Rules

- Evidence packs must be generated deterministically
- Re-exporting the same pack must yield identical results
- Partial or incomplete evidence packs must not be exported

If any required artefact is missing:
- export must fail
- failure must be explicit

---

## Validation Requirement

Evidence export logic must validate this checklist **before exporting**.

An evidence pack that does not meet these requirements is invalid.

---

## Summary

Evidence packs are not best-effort artefacts.

They are **first-class, governed outputs** designed to support:
- audit
- replay
- regulatory review

Completeness is mandatory.
