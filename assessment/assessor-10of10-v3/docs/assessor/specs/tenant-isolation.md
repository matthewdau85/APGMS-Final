# Tenant Isolation Spec

## Objective
Guarantee that data for one orgId is not accessible to any other orgId across:
- API routes
- Database queries
- Caches/queues
- Exports

## Controls
1. **Org scoping is mandatory**
   - All domain operations require orgId.
   - orgId is derived from the authenticated principal and cannot be supplied by the caller for privileged reads.

2. **Query enforcement**
   - Repository layer requires orgId filters.
   - For relational stores: prefer row-level security (RLS) where feasible, otherwise strict query filters.

3. **Cache keys**
   - All cache keys must include orgId.
   - No shared global keys for org-scoped artifacts.

4. **Exports**
   - Export jobs must require orgId and produce org-scoped bundles only.

## Tests
- Unit: repositories reject calls without orgId.
- E2E: cross-tenant access returns 403 and does not leak any fields.
- Regression: add fixtures for two tenants and ensure stable behaviour.

## Evidence
- E2E contract: docs/assessor/contracts/e2e-contract.json (/contracts/tenantIsolation)
