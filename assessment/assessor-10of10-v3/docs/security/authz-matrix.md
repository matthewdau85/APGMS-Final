# Authorization Matrix

## Version
- Version: 1.0
- Last updated: 2025-12-13

## Roles
- ADMIN
- ORG_OWNER
- ORG_USER
- REGULATOR_READONLY

## Actions (examples)
| Action | ADMIN | ORG_OWNER | ORG_USER | REGULATOR_READONLY |
|---|---|---|---|---|
| Create org | allow | deny | deny | deny |
| Upload payroll | deny | allow | allow | deny |
| Create BAS settlement | deny | allow | deny | deny |
| View compliance summary | allow | allow | allow | allow |
