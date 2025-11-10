import { encryptEnvelope, decryptEnvelope, encryptJson, decryptJson, type any } from "@apgms/shared";
import { config } from "../config.js";

const masterKey = config.encryption.masterKey;

export { any };

export function sealSecret(value: string, context: string): any {
  return encryptEnvelope(masterKey, value, Buffer.from(context, "utf8"));
}

export function unsealSecret(envelope: any, context: string): string {
  const buffer = decryptEnvelope(masterKey, envelope, Buffer.from(context, "utf8"));
  return buffer.toString("utf8");
}

export function sealObject<T>(value: T, context: string): any {
  return encryptJson(masterKey, value, Buffer.from(context, "utf8"));
}

export function unsealObject<T>(envelope: any, context: string): T {
  return (decryptJson(masterKey, envelope, Buffer.from(context, "utf8"))) as T;
}

