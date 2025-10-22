import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AdminGuard, AdminGuardResult } from "./pii";

export const ADMIN_TOKEN_HEADER = "x-admin-token";

export interface AdminVerificationResult extends AdminGuardResult {}

function normaliseHeader(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : undefined;
  }
  return String(value);
}

function computeActorId(token: string): string {
  const digest = createHash("sha256").update(token).digest("base64url");
  return `admin:${digest.slice(0, 16)}`;
}

export function verifySignedAdmin(request: FastifyRequest): AdminVerificationResult {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    return { allowed: false, actorId: "unknown", reason: "missing_config" };
  }

  const providedHeader =
    request.headers[ADMIN_TOKEN_HEADER] ??
    request.headers[ADMIN_TOKEN_HEADER.toUpperCase() as keyof typeof request.headers];
  const provided = normaliseHeader(providedHeader)?.trim();

  if (!provided) {
    return { allowed: false, actorId: "unknown", reason: "unauthorized" };
  }

  const expectedBuffer = Buffer.from(configuredToken, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return { allowed: false, actorId: "unknown", reason: "unauthorized" };
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { allowed: false, actorId: "unknown", reason: "unauthorized" };
  }

  return { allowed: true, actorId: computeActorId(configuredToken) };
}

export function requireSignedAdmin(req: FastifyRequest, rep: FastifyReply): boolean {
  const decision = verifySignedAdmin(req);
  if (!decision.allowed) {
    if (decision.reason === "missing_config") {
      req.log.error("ADMIN_TOKEN is not configured");
      void rep.code(500).send({ error: "admin_config_missing" });
    } else {
      void rep.code(403).send({ error: "forbidden" });
    }
    return false;
  }
  return true;
}

export function createSignedAdminGuard(): AdminGuard {
  return (request) => verifySignedAdmin(request);
}
