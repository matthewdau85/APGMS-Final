# Authentication Toggle Reference

## Scope and search summary
- Searched `services/` and `apps/` for `authenticateRequest`, `authGuard`, and `gate` to map guarded routes and request context usage.
- No application packages under `apps/` use these helpers; all hits are inside `services/api-gateway`.

## `authenticateRequest` call sites
### `services/api-gateway/src/routes/tax.ts`
- Applies `authenticateRequest` through a local `guard` wrapper on `GET /tax/health` with role filtering supplied at call-time (`roles: readonly Role[]`). 【F:services/api-gateway/src/routes/tax.ts†L6-L27】
- The handler does not touch `request.user`; authorization relies entirely on the returned principal from `authenticateRequest` to decide whether processing continues. 【F:services/api-gateway/src/routes/tax.ts†L9-L27】

### `services/api-gateway/src/routes/tax.js`
- Compiled variant of the tax route guards `GET /tax/health` with `authenticateRequest`, enforcing the `["admin", "analyst", "finance"]` role list before probing the upstream tax engine. 【F:services/api-gateway/src/routes/tax.js†L14-L51】
- Downstream logic uses the authenticated principal only to short-circuit when authorization fails; the handler does not read `request.user` directly. 【F:services/api-gateway/src/routes/tax.js†L14-L51】

### `services/api-gateway/src/routes/admin.data.ts`
- Wraps `authenticateRequest` in a `gate(roles)` helper applied to:
  - `GET /admin/data` (no explicit role filter) which expects `request.user.orgId` to scope returned records. 【F:services/api-gateway/src/routes/admin.data.ts†L8-L24】
  - `DELETE /admin/data/:id` requiring the `admin` role and reusing `request.user.orgId` to constrain deletions. 【F:services/api-gateway/src/routes/admin.data.ts†L8-L24】
- Both handlers cast `request.user` to access the caller’s `orgId` after authentication. 【F:services/api-gateway/src/routes/admin.data.ts†L12-L22】

### `services/api-gateway/src/routes/admin.data.js`
- Legacy/compiled admin routes call `authenticateRequest` for:
  - `POST /admin/data/delete` (admin-only) before running delete/anonymize flows with the returned `principal` context. 【F:services/api-gateway/src/routes/admin.data.js†L29-L103】
  - `POST /admin/data/export` (admin-only) to authorize data exports and populate audit metadata from the principal’s org and id. 【F:services/api-gateway/src/routes/admin.data.js†L115-L190】
- Handlers depend on the `principal` payload (orgId, id, roles) supplied by `authenticateRequest`; they do not use `request.user` directly but they propagate role/org information into security logging and auditing. 【F:services/api-gateway/src/routes/admin.data.js†L29-L190】

## `authGuard` usage
### Definition
- `authGuard` originates from `createAuthGuard` in `services/api-gateway/src/auth.ts`, where verified JWT claims are attached to `request.user` for downstream handlers. 【F:services/api-gateway/src/auth.ts†L143-L188】

### Routes guarded by `authGuard`
All routes below live in `services/api-gateway/src/routes/auth.ts` and call `authGuard` as a `preHandler`:
- `GET /auth/mfa/status` reads `request.user.sub` to load the active user. 【F:services/api-gateway/src/routes/auth.ts†L19-L73】
- `POST /auth/mfa/totp/begin` fetches user/org identifiers from `request.user`. 【F:services/api-gateway/src/routes/auth.ts†L74-L141】
- `POST /auth/mfa/totp/confirm` validates the pending enrollment using `request.user.sub`. 【F:services/api-gateway/src/routes/auth.ts†L142-L221】
- `POST /auth/mfa/step-up` verifies MFA challenges for the authenticated session. 【F:services/api-gateway/src/routes/auth.ts†L222-L305】
- `POST /auth/mfa/passkey/registration-options` seeds WebAuthn registration using `request.user` context. 【F:services/api-gateway/src/routes/auth.ts†L306-L369】
- `POST /auth/mfa/passkey/register` persists passkey credentials for the authenticated user. 【F:services/api-gateway/src/routes/auth.ts†L370-L446】
- `POST /auth/mfa/passkey/authentication-options` lists credentials for the authenticated user. 【F:services/api-gateway/src/routes/auth.ts†L447-L508】
- `POST /auth/mfa/passkey/verify` validates passkey assertions and updates counters. 【F:services/api-gateway/src/routes/auth.ts†L509-L561】
- `POST /auth/mfa/reset` clears temporary verification state for the authenticated user. 【F:services/api-gateway/src/routes/auth.ts†L562-L575】

### Additional hooks
- `services/api-gateway/src/app.ts` imports `authGuard` to support route registration and uses `createAuthGuard` again for regulator-prefixed scopes, showing how the guard attaches additional session context. 【F:services/api-gateway/src/app.ts†L10-L217】

## `gate` helper usage
- Only `services/api-gateway/src/routes/admin.data.ts` defines a `gate(roles)` convenience wrapper around `authenticateRequest`, enabling per-route role lists. 【F:services/api-gateway/src/routes/admin.data.ts†L8-L24】

## Modules that consume `request.user` or role data
- `services/api-gateway/src/plugins/auth.ts` populates `request.user` during authentication, shaping the user object (`sub`, `orgId`, `role`, `mfaEnabled`). 【F:services/api-gateway/src/plugins/auth.ts†L8-L45】
- `services/api-gateway/src/utils/orgScope.ts` expects `request.user.orgId` and `request.user.role` to enforce organization and role checks for bank-line operations. 【F:services/api-gateway/src/utils/orgScope.ts†L5-L40】
- `services/api-gateway/src/routes/bank-lines.ts` pulls `(req as any).user` to authorize access before reading or writing bank lines. 【F:services/api-gateway/src/routes/bank-lines.ts†L22-L64】
- `services/api-gateway/src/routes/bank-lines.js` (compiled counterpart) relies on `assertOrgAccess`/`assertRoleForBankLines`, which in turn read `request.user.orgId` and `request.user.role`. 【F:services/api-gateway/src/routes/bank-lines.js†L1-L52】
- `services/api-gateway/src/routes/admin.data.ts` reads `(req as any).user?.orgId` directly to scope admin data. 【F:services/api-gateway/src/routes/admin.data.ts†L12-L22】
- `services/api-gateway/src/routes/auth.ts` consistently accesses `(request as any).user` to derive `sub`, `orgId`, and role-linked behavior across MFA and passkey flows. 【F:services/api-gateway/src/routes/auth.ts†L19-L575】
- `services/api-gateway/src/auth.ts` injects validated claim data into `request.user`, ensuring all downstream consumers receive the same shape. 【F:services/api-gateway/src/auth.ts†L143-L188】
