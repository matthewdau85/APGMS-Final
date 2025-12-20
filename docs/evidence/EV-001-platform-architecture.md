# EV-001 - Platform Architecture Evidence

## Control Objective
Demonstrate the service boundaries, tenancy scoping, and shared module layout
used by APGMS.

## Evidence
- ADR-001: Platform Architecture & Tenancy
  (`docs/architecture/ADR-001-platform-architecture.md`)
- Service boundary implementation:
  - `services/api-gateway/` (edge gateway + auth scope)
  - `shared/src/messaging/` (event bus primitives)
  - `shared/src/tax/` (tax calculation helpers)

## Verification
- Review ADR-001 for the decision record.
- Confirm service directories and shared modules are present in the tree.
