# Access Control Policy

## Model
- Tenant-scoped roles (orgId scoped)
- Admin roles (platform-scoped)

## Principles
- Default deny
- Least privilege
- Explicit privileged actions

## Authentication
- Token-based auth (JWT or equivalent)
- Session expiration enforced

## Authorization
- Requests evaluated against authz matrix.
