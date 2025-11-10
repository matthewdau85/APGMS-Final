import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import { importJWK, jwtVerify, } from "jose";
const clockToleranceSeconds = Number(process.env.AUTH_CLOCK_TOLERANCE_S ?? "5");
const keyCache = new Map();
export class AuthError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 401, code = "unauthorized") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}
async function loadKeys() {
    if (keyCache.size > 0) {
        return;
    }
    const jwksEnv = process.env.AUTH_JWKS;
    if (!jwksEnv) {
        throw new AuthError("JWT configuration missing", 500, "jwt_config_missing");
    }
    let parsed;
    try {
        parsed = JSON.parse(jwksEnv);
    }
    catch (error) {
        throw new AuthError("Invalid JWT key set", 500, "jwt_config_invalid");
    }
    if (!parsed.keys || parsed.keys.length === 0) {
        throw new AuthError("JWT key set is empty", 500, "jwt_config_invalid");
    }
    await Promise.all(parsed.keys.map(async (jwk) => {
        if (!jwk.kid) {
            throw new Error("JWK entries must include a kid");
        }
        if (!jwk.alg) {
            throw new Error(`JWK ${jwk.kid} is missing alg`);
        }
        const key = await importJWK(jwk, jwk.alg);
        keyCache.set(jwk.kid, { kid: jwk.kid, key, alg: jwk.alg });
    }));
}
async function resolveKey(kid) {
    if (!kid) {
        throw new Error("JWT header missing kid");
    }
    const cached = keyCache.get(kid);
    if (!cached) {
        throw new Error(`Unknown kid ${kid}`);
    }
    return cached;
}
function normaliseRoles(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    const roles = raw.filter((value) => typeof value === "string");
    return Array.from(new Set(roles));
}
export async function verifyRequest(request, reply) {
    const header = request.headers.authorization ??
        request.headers["Authorization"];
    const audience = process.env.AUTH_AUDIENCE;
    const issuer = process.env.AUTH_ISSUER;
    if (!audience || !issuer) {
        throw new AuthError("JWT configuration missing", 500, "jwt_config_missing");
    }
    await loadKeys();
    const value = Array.isArray(header) ? header?.[0] : header;
    if (!value) {
        throw new AuthError("Authorization header missing");
    }
    const match = /^Bearer\s+(.+)$/i.exec(value.trim());
    if (!match) {
        throw new AuthError("Unsupported authorization scheme");
    }
    const token = match[1];
    let verification;
    try {
        verification = await jwtVerify(token, async (header) => {
            const { kid } = header;
            const key = await resolveKey(kid);
            return key.key;
        }, {
            audience,
            issuer,
            clockTolerance: clockToleranceSeconds,
        });
    }
    catch (error) {
        throw new AuthError("Token verification failed");
    }
    const { payload, protectedHeader } = verification;
    const principal = buildPrincipalFromPayload(payload, protectedHeader.kid, token);
    request.log.debug({
        principal: {
            id: principal.id,
            org: principal.orgId,
            roles: principal.roles,
            kid: protectedHeader.kid,
        },
    }, "verified principal");
    return principal;
}
function buildPrincipalFromPayload(payload, kid, token) {
    const sub = payload.sub;
    const orgId = typeof payload.org === "string" ? payload.org : undefined;
    const roles = normaliseRoles(payload.roles);
    if (!sub || !orgId) {
        throw new AuthError("Token missing required claims");
    }
    if (roles.length === 0) {
        throw new AuthError("Token missing roles claim");
    }
    return {
        id: sub,
        orgId,
        roles,
        token,
    };
}
export function requireRole(principal, allowed) {
    if (allowed.length === 0) {
        return;
    }
    const hasRole = principal.roles.some((role) => allowed.some((allowedRole) => timingSafeEqual(Buffer.from(role), Buffer.from(allowedRole))));
    if (!hasRole) {
        throw new AuthError("Forbidden", 403, "forbidden");
    }
}
export function hashIdentifier(value) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
export async function authenticateRequest(app, request, reply, roles) {
    const metrics = app.metrics;
    try {
        const principal = await verifyRequest(request, reply);
        requireRole(principal, roles);
        request.principal = principal;
        request.user = {
            sub: principal.id,
            orgId: principal.orgId,
            role: principal.roles[0] ?? principal.roles[principal.roles.length - 1] ?? "analyst",
            roles: principal.roles,
            token: principal.token,
            mfaEnabled: false,
        };
        metrics?.recordSecurityEvent("auth.success");
        return principal;
    }
    catch (error) {
        if (error instanceof AuthError) {
            const code = error.statusCode === 403 ? "auth.forbidden" : "auth.unauthorized";
            metrics?.recordSecurityEvent(code);
            void reply.code(error.statusCode).send({ error: error.code ?? "unauthorized" });
            return null;
        }
        throw error;
    }
}
