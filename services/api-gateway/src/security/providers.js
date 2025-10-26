import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { createSecretManager } from "@apgms/shared";
function decodeKeyMaterial(raw) {
    return {
        kid: raw.kid,
        material: Buffer.from(raw.material, "base64"),
    };
}
class EnvKeyManagementService {
    keys = new Map();
    activeKid;
    constructor(rawKeys, activeKid) {
        if (rawKeys.length === 0) {
            throw new Error("PII_KEYS must provide at least one key");
        }
        for (const raw of rawKeys) {
            if (!raw.kid || !raw.material) {
                throw new Error("PII_KEYS entries require kid and material");
            }
            this.keys.set(raw.kid, decodeKeyMaterial(raw));
        }
        this.activeKid = activeKid ?? rawKeys[0].kid;
        if (!this.keys.has(this.activeKid)) {
            throw new Error(`PII_ACTIVE_KEY ${this.activeKid} missing from key set`);
        }
    }
    getActiveKey() {
        const key = this.keys.get(this.activeKid);
        if (!key) {
            throw new Error(`Active key ${this.activeKid} is not available`);
        }
        return key;
    }
    getKeyById(kid) {
        return this.keys.get(kid);
    }
}
class EnvSaltProvider {
    salts = new Map();
    activeSid;
    constructor(rawSalts, activeSid) {
        if (rawSalts.length === 0) {
            // generate ephemeral salt to avoid crashes, but warn
            const sid = `ephemeral-${Date.now()}`;
            const secret = randomBytes(32);
            this.salts.set(sid, { sid, secret });
            this.activeSid = sid;
            return;
        }
        for (const raw of rawSalts) {
            if (!raw.sid || !raw.secret) {
                throw new Error("PII_SALTS entries require sid and secret");
            }
            this.salts.set(raw.sid, {
                sid: raw.sid,
                secret: Buffer.from(raw.secret, "base64"),
            });
        }
        this.activeSid = activeSid ?? rawSalts[0].sid;
        if (!this.salts.has(this.activeSid)) {
            throw new Error(`PII_ACTIVE_SALT ${this.activeSid} missing from salt set`);
        }
    }
    getActiveSalt() {
        const salt = this.salts.get(this.activeSid);
        if (!salt) {
            throw new Error("Active salt is not available");
        }
        return salt;
    }
    getSaltById(id) {
        return this.salts.get(id);
    }
}
class PrismaAuditLogger {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(event) {
        const payload = event;
        try {
            await this.prisma.auditLog.create({
                data: {
                    actorId: payload.actorId,
                    action: payload.action,
                    orgId: payload.metadata?.orgId ?? "unknown",
                    metadata: payload.metadata ?? {},
                },
            });
        }
        catch (error) {
            // Failing closed to avoid leaking operations; log and continue
            console.error("unable to persist audit log", error);
            throw error;
        }
    }
}
export async function createKeyManagementService() {
    const secretManager = createSecretManager();
    const rawKeys = await readJsonSecret(secretManager, "PII_KEYS", process.env.PII_KEYS_SECRET_PATH);
    const activeKid = process.env.PII_ACTIVE_KEY;
    return new EnvKeyManagementService(rawKeys ?? [], activeKid);
}
export async function createSaltProvider() {
    const secretManager = createSecretManager();
    const rawSalts = await readJsonSecret(secretManager, "PII_SALTS", process.env.PII_SALTS_SECRET_PATH);
    const activeSid = process.env.PII_ACTIVE_SALT;
    return new EnvSaltProvider(rawSalts ?? [], activeSid);
}
export function createAuditLogger(prisma) {
    return new PrismaAuditLogger(prisma);
}
async function readJsonSecret(secretManager, envName, secretPath) {
    const identifier = secretPath ?? envName;
    const secret = await secretManager.getSecret(identifier);
    if (secret) {
        return parseJson(secret, identifier);
    }
    const fallback = process.env[envName];
    if (fallback) {
        return parseJson(fallback, envName);
    }
    return undefined;
}
function parseJson(value, name) {
    try {
        return JSON.parse(value);
    }
    catch (error) {
        throw new Error(`${name} must contain valid JSON`);
    }
}
