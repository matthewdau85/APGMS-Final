import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
const AES_ALGORITHM = "aes-256-gcm";
const AES_IV_LENGTH = 12;
const AES_AUTH_TAG_LENGTH = 16;
let context;
export function configurePIIProviders(newContext) {
    context = newContext;
}
export function tokenizeTFN(plain) {
    if (!context) {
        throw new Error("PII providers not configured");
    }
    const normalized = plain.replace(/\s+/g, "");
    if (!/^\d{8,9}$/.test(normalized)) {
        throw new Error("Invalid TFN format");
    }
    const { sid, secret } = context.saltProvider.getActiveSalt();
    const digest = createHmac("sha256", secret).update(normalized).digest("base64url");
    return `${sid}.${digest}`;
}
export function encryptPII(plain) {
    if (!context) {
        throw new Error("PII providers not configured");
    }
    const key = context.kms.getActiveKey();
    if (key.material.length !== 32) {
        throw new Error("Invalid encryption key length");
    }
    const iv = randomBytes(AES_IV_LENGTH);
    const cipher = createCipheriv(AES_ALGORITHM, key.material, iv, { authTagLength: AES_AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, authTag, encrypted]);
    return { kid: key.kid, ciphertext: payload.toString("base64") };
}
export function decryptPII(payload) {
    if (!context) {
        throw new Error("PII providers not configured");
    }
    const key = context.kms.getKeyById(payload.kid);
    if (!key) {
        throw new Error("Unknown key identifier");
    }
    const data = Buffer.from(payload.ciphertext, "base64");
    if (data.length < AES_IV_LENGTH + AES_AUTH_TAG_LENGTH) {
        throw new Error("Malformed ciphertext");
    }
    const iv = data.subarray(0, AES_IV_LENGTH);
    const authTag = data.subarray(AES_IV_LENGTH, AES_IV_LENGTH + AES_AUTH_TAG_LENGTH);
    const encrypted = data.subarray(AES_IV_LENGTH + AES_AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(AES_ALGORITHM, key.material, iv, { authTagLength: AES_AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
}
export function registerPIIRoutes(app, guard) {
    app.post("/admin/pii/decrypt", async (request, reply) => {
        if (!context) {
            return reply.code(500).send({ error: "pii_unconfigured" });
        }
        const decision = await guard(request);
        if (!decision.allowed) {
            return reply.code(403).send({ error: "forbidden" });
        }
        const body = request.body;
        if (!body?.ciphertext || !body?.kid) {
            return reply.code(400).send({ error: "invalid_request" });
        }
        try {
            const value = decryptPII({ ciphertext: body.ciphertext, kid: body.kid });
            await context.auditLogger.record({
                actorId: decision.actorId,
                action: "pii.decrypt",
                timestamp: new Date().toISOString(),
                metadata: { kid: body.kid },
            });
            return reply.code(200).send({ value });
        }
        catch (error) {
            return reply.code(400).send({ error: "invalid_payload" });
        }
    });
}
