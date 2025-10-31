import crypto from "node:crypto";
const DATA_KEY_LENGTH = 32;
const GCM_IV_LENGTH = 12;
function ensureBuffer(data) {
    return Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
}
export function encryptEnvelope(masterKey, plaintext, associatedData) {
    if (masterKey.length !== 32) {
        throw new Error("master key must be 32 bytes");
    }
    const payload = ensureBuffer(plaintext);
    const aad = associatedData ? ensureBuffer(associatedData) : undefined;
    const dataKey = crypto.randomBytes(DATA_KEY_LENGTH);
    const payloadIv = crypto.randomBytes(GCM_IV_LENGTH);
    const payloadCipher = crypto.createCipheriv("aes-256-gcm", dataKey, payloadIv);
    if (aad) {
        payloadCipher.setAAD(aad, { plaintextLength: payload.length });
    }
    const ciphertext = Buffer.concat([payloadCipher.update(payload), payloadCipher.final()]);
    const payloadTag = payloadCipher.getAuthTag();
    const wrappedIv = crypto.randomBytes(GCM_IV_LENGTH);
    const wrapCipher = crypto.createCipheriv("aes-256-gcm", masterKey, wrappedIv);
    const wrappedKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
    const wrappedTag = wrapCipher.getAuthTag();
    return {
        alg: "AES-256-GCM",
        iv: payloadIv.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
        tag: payloadTag.toString("base64"),
        key: {
            iv: wrappedIv.toString("base64"),
            ciphertext: wrappedKey.toString("base64"),
            tag: wrappedTag.toString("base64"),
        },
    };
}
export function decryptEnvelope(masterKey, envelope, associatedData) {
    if (masterKey.length !== 32) {
        throw new Error("master key must be 32 bytes");
    }
    const aad = associatedData ? ensureBuffer(associatedData) : undefined;
    const wrappedIv = Buffer.from(envelope.key.iv, "base64");
    const wrappedKey = Buffer.from(envelope.key.ciphertext, "base64");
    const wrappedTag = Buffer.from(envelope.key.tag, "base64");
    const unwrapCipher = crypto.createDecipheriv("aes-256-gcm", masterKey, wrappedIv);
    unwrapCipher.setAuthTag(wrappedTag);
    const dataKey = Buffer.concat([unwrapCipher.update(wrappedKey), unwrapCipher.final()]);
    const payloadIv = Buffer.from(envelope.iv, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const payloadTag = Buffer.from(envelope.tag, "base64");
    const payloadCipher = crypto.createDecipheriv("aes-256-gcm", dataKey, payloadIv);
    if (aad) {
        payloadCipher.setAAD(aad, { plaintextLength: ciphertext.length });
    }
    payloadCipher.setAuthTag(payloadTag);
    const plaintext = Buffer.concat([payloadCipher.update(ciphertext), payloadCipher.final()]);
    return plaintext;
}
export function encryptJson(masterKey, value, associatedData) {
    const payload = Buffer.from(JSON.stringify(value), "utf8");
    return encryptEnvelope(masterKey, payload, associatedData);
}
export function decryptJson(masterKey, envelope, associatedData) {
    const payload = decryptEnvelope(masterKey, envelope, associatedData);
    return JSON.parse(payload.toString("utf8"));
}
