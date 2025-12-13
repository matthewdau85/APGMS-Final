# AuthZ Matrix (routes -> roles -> permissions)

| Route | Method | Required Role | Tenant scope source | Notes |
|------|--------|---------------|---------------------|------|
| /api/bank-lines | GET | ORG_USER | token.orgId | returns 401 unauth, 403 cross-org |
| /api/bas-settlement | POST | ORG_ADMIN | token.orgId | gated by BAS lodgment |
| /api/export | GET | ORG_ADMIN | token.orgId | export is audited |

Add all routes in services/api-gateway/src/routes/* and keep this matrix current.
