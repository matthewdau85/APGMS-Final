import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { type AuditLogger, type KeyManagementService, type TokenSaltProvider } from "@apgms/shared/pii";

const AES_ALGORITHM = "aes-256-gcm";
const AES_IV_LENGTH = 12;
const AES_AUTH_TAG_LENGTH = 16;

interface PIIContext {
  kms: KeyManagementService;
  saltProvider: TokenSaltProvider;
  auditLogger: AuditLogger;
}

let context: PIIContext | undefined;

export function configurePIIProviders(newContext: PIIContext): void {
  context = newContext;
}

export function tokenizeTFN(plain: string): string {
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

export function encryptPII(plain: string): { ciphertext: string; kid: string } {
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

export function decryptPII(payload: { ciphertext: string; kid: string }): string {
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

export interface AdminGuardResult {
  allowed: boolean;
  actorId: string;
}

export type AdminGuard = (request: FastifyRequest) => Promise<AdminGuardResult> | AdminGuardResult;

export class AdminGuardConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminGuardConfigurationError";
  }
}

export function registerPIIRoutes(app: FastifyInstance, guard: AdminGuard): void {
  app.post(
    "/admin/pii/decrypt",
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      if (!context) {
        return reply.code(500).send({ error: "pii_unconfigured" });
      }

      let decision: AdminGuardResult;
      try {
        decision = await guard(request);
      } catch (error) {
        request.log.error({ err: error }, "admin guard failed");
        if (error instanceof AdminGuardConfigurationError) {
          return reply.code(500).send({ error: "admin_config_missing" });
        }
        return reply.code(500).send({ error: "guard_failed" });
      }
      if (!decision.allowed) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const body = request.body as { ciphertext?: string; kid?: string };
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
      } catch (error) {
        request.log.warn({ err: error }, "failed to decrypt pii payload");
        return reply.code(400).send({ error: "invalid_payload" });
      }
    },
  );
}
