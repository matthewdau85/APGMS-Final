# Audit Immutability Spec

## Objective
Ensure audit events are:
- **Append-only**
- **Tamper-evident**
- **Queryable with integrity**

## Minimum design
1. Append-only storage (no updates/deletes by application paths)
2. Immutable event schema versioning
3. Optional hash chaining:
   - Each event stores prevHash and eventHash = H(prevHash || canonical(event))
4. Retention policy aligned with compliance needs
5. Export capability:
   - Time-bounded export with hashes for verification

## Controls and tests
- Unit test: attempts to update/delete audit events are rejected.
- E2E: admin actions produce corresponding audit events.
- Operations: audit export can be generated and verified.

## Evidence
- Admin audit unit tests exist in services/api-gateway/test (when implemented).
