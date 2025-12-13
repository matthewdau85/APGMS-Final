# Tenant isolation spec

Non-negotiable invariant:
- No principal can read or mutate data outside their organisation scope.

Minimum expectations:
- Every API handler must derive org scope from verified auth context (not request payload).
- DB queries must include orgId constraints (or equivalent tenancy partition key).
- Cross-org access attempts must return 403 (preferred) or 404 (acceptable) and must be audited.

Evidence targets:
- docs/security/authz-matrix.md includes tenancy scope model
- E2E contract "tenantIsolation" is executable and passing
- Unit tests cover repository-layer org scoping
