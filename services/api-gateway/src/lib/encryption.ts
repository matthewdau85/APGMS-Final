import { decryptEnvelope, decryptJson, encryptEnvelope, encryptJson, type EncryptionEnvelope } from "@apgms/shared";

import { config } from "../config.js";

const masterKey = config.encryption.masterKey;

export type { EncryptionEnvelope } from "@apgms/shared";

export function sealSecret(value: string, context: string): EncryptionEnvelope {
  return encryptEnvelope(masterKey, value, Buffer.from(context, "utf8"));
}

export function unsealSecret(envelope: EncryptionEnvelope, context: string): string {
  const buffer = decryptEnvelope(masterKey, envelope, Buffer.from(context, "utf8"));
  return buffer.toString("utf8");
}

export function sealObject<T>(value: T, context: string): EncryptionEnvelope {
  return encryptJson(masterKey, value, Buffer.from(context, "utf8"));
}

export function unsealObject<T>(envelope: EncryptionEnvelope, context: string): T {
  return decryptJson<T>(masterKey, envelope, Buffer.from(context, "utf8"));
}
