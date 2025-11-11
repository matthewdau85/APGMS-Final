// services/api-gateway/src/routes/auth.ts
import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import {
  authGuard,
  verifyCredentials,
  signToken,
  buildClientUser,
  buildSessionUser,
} from "../auth.js";
import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";
import {
  grantStepUpSession,
  clearVerification,
  requireRecentVerification,
  verifyChallenge,
} from "../security/mfa.js";
import {
  generateTotpSecret,
  verifyTotpToken,
  buildTotpUri,
  LoginBodySchema,
  TotpConfirmBodySchema,
  MfaStepUpBodySchema,
  PasskeyRegistrationBodySchema,
  PasskeyVerifyBodySchema,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  badRequest,
} from "@apgms/shared";
import { parseWithSchema } from "../lib/validation.js";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import {
  hashRecoveryCode,
  upsertTotpCredential,
  getTotpCredential,
  listPasskeyCredentials,
  savePasskeyCredential,
  decodePasskeyCredential,
  hasTotp,
  updatePasskeyCounter,
} from "../lib/mfa-store.js";
import {
  createRegistrationOptions,
  verifyPasskeyRegistration,
  createAuthenticationOptions,
  verifyPasskeyAuthentication,
} from "../security/webauthn.js";

type PendingTotpSetup = {
  secret: string;
  codesPlain: string[];
  codesHashed: Array<{ hash: string; used: boolean }>;
  expiresAt: number;
};

const PENDING_TOTP_TTL_MS = 10 * 60 * 1000;
const pendingTotpEnrollments = new Map<string, PendingTotpSetup>();
const TOTP_ISSUER = "APGMS";

function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

function cleanupPendingTotp(): void {
  const ts = Date.now();
  for (const [userId, entry] of pendingTotpEnrollments.entries()) {
    if (entry.expiresAt <= ts) {
      pendingTotpEnrollments.delete(userId);
    }
  }
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = parseWithSchema(LoginBodySchema, request.body);

    const user = await verifyCredentials(body.email, body.password);

    if (!user) {
      throw unauthorized("bad_credentials", "Invalid email/password");
    }

    const authUser = buildSessionUser(user);
    const token = await signToken({
      id: authUser.sub,
      orgId: authUser.orgId,
      role: authUser.role,
      mfaEnabled: authUser.mfaEnabled,
    });

    reply.send({
      token,
      user: buildClientUser(authUser),
    });
  });

  app.get(
    "/auth/mfa/status",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, orgId: true, mfaEnabled: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      const [totpCredential, passkeys] = await Promise.all([
        getTotpCredential(user.id),
        listPasskeyCredentials(user.id),
      ]);

      const recoveryRemaining = totpCredential
        ? totpCredential.recoveryCodes.filter((entry) => !entry.used).length
        : 0;

      const pending = pendingTotpEnrollments.get(user.id);
      const stepUpActive = requireRecentVerification(user.id);

      reply.send({
        mfaEnabled: user.mfaEnabled,
        stepUpActive,
        totp: {
          enabled: Boolean(totpCredential),
          recoveryCodesRemaining: recoveryRemaining,
          pending: pending
            ? { expiresAt: new Date(pending.expiresAt).toISOString() }
            : null,
        },
        passkey: {
          enrolled: passkeys.length,
        },
      });
    },
  );

  app.post(
    "/auth/mfa/totp/begin",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, orgId: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      cleanupPendingTotp();

      const secret = generateTotpSecret();
      const existingTotp = await hasTotp(user.id);
      const recoveryCodes = generateRecoveryCodes();
      const hashedRecoveryCodes = recoveryCodes.map((code) => ({
        hash: hashRecoveryCode(code),
        used: false,
      }));
      const expiresAt = Date.now() + PENDING_TOTP_TTL_MS;

      pendingTotpEnrollments.set(user.id, {
        secret,
        codesPlain: recoveryCodes,
        codesHashed: hashedRecoveryCodes,
        expiresAt,
      });

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.totp.begin",
        metadata: {
          hasExistingTotp: existingTotp,
        },
      });

      reply.send({
        secret,
        otpauthUrl: buildTotpUri(
          secret,
          `${user.email ?? user.id}`,
          TOTP_ISSUER,
        ),
        recoveryCodes,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    },
  );

  app.post(
    "/auth/mfa/totp/confirm",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      const body = parseWithSchema(TotpConfirmBodySchema, request.body);

      cleanupPendingTotp();
      const pending = pendingTotpEnrollments.get(user.id);
      if (!pending) {
        throw conflict("totp_enrollment_missing", "No pending TOTP enrollment");
      }

      const trimmed = body.token.replace(/\s+/g, "");
      if (!verifyTotpToken(pending.secret, trimmed)) {
        throw unauthorized("totp_invalid", "Invalid TOTP token");
      }

      await upsertTotpCredential(user.id, pending.secret, pending.codesHashed);
      pendingTotpEnrollments.delete(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });

      const sessionExpiry = grantStepUpSession(user.id);

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.totp.confirm",
        metadata: {
          recoveryCodesIssued: pending.codesPlain.length,
        },
      });

      reply.send({
        status: "enabled",
        recoveryCodes: pending.codesPlain,
        session: {
          expiresAt: sessionExpiry.toISOString(),
        },
      });
    },
  );

  app.post(
    "/auth/mfa/step-up",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const body = parseWithSchema(MfaStepUpBodySchema, request.body);

      const result = await verifyChallenge(userId, body.code);
      if (!result.success) {
        throw unauthorized("mfa_invalid", "MFA verification failed");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true },
      });

      await recordAuditLog({
        orgId: user?.orgId ?? "unknown",
        actorId: userId,
        action: "auth.mfa.stepUp",
        metadata: {
          method: result.method,
          recoveryCodesRemaining: result.remainingRecoveryCodes,
        },
      });

      reply.send({
        status: "verified",
        session: {
          expiresAt: result.expiresAt?.toISOString(),
        },
      });
    },
  );

  app.post(
    "/auth/mfa/passkey/registration-options",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, orgId: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      const existing = await listPasskeyCredentials(user.id);
      const excludeCredentialIds = existing
        .map((cred) => cred.credentialId)
        .filter((id): id is string => Boolean(id));

      const options = await createRegistrationOptions({
        userId: user.id,
        username: user.email ?? user.id,
        displayName: user.email ?? user.id,
        excludeCredentialIds,
      });

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.passkey.registrationOptions",
        metadata: {
          existingCredentials: existing.length,
        },
      });

      reply.send(options);
    },
  );

  app.post(
    "/auth/mfa/passkey/register",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      const body = parseWithSchema(PasskeyRegistrationBodySchema, request.body);
      const registrationResponse = (body.credential ?? body.response) as RegistrationResponseJSON;
      if (!registrationResponse) {
        throw badRequest("invalid_body", "registration response is required");
      }

      const verification = await verifyPasskeyRegistration(user.id, registrationResponse);
      if (!verification.verified || !verification.registrationInfo) {
        throw unauthorized("passkey_invalid", "Registration verification failed");
      }

      const credential = verification.registrationInfo.credential;
      const credentialId = credential.id;
      await savePasskeyCredential(
        user.id,
        credentialId,
        Buffer.from(credential.publicKey),
        credential.counter,
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });

      const sessionExpiry = grantStepUpSession(user.id);

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.passkey.register",
        metadata: {
          credentialId,
        },
      });

      reply.send({
        status: "registered",
        session: {
          expiresAt: sessionExpiry.toISOString(),
        },
      });
    },
  );

  app.post(
    "/auth/mfa/passkey/authentication-options",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      const credentials = await listPasskeyCredentials(user.id);
      const allowCredentialIds = credentials
        .map((cred) => cred.credentialId)
        .filter((id): id is string => Boolean(id));

      if (allowCredentialIds.length === 0) {
        throw notFound("passkey_not_configured", "No passkey credentials available");
      }

      const options = await createAuthenticationOptions({
        userId: user.id,
        allowCredentialIds,
      });

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.passkey.authenticationOptions",
        metadata: {
          credentialCount: credentials.length,
        },
      });

      reply.send(options);
    },
  );

  app.post(
    "/auth/mfa/passkey/verify",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;

      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true },
      });

      if (!user) {
        throw notFound("user_not_found", "User record missing");
      }

      const body = parseWithSchema(PasskeyVerifyBodySchema, request.body);
      const assertionResponse = (body.credential ?? body.response) as AuthenticationResponseJSON;
      if (!assertionResponse) {
        throw badRequest("invalid_body", "authentication response is required");
      }

      const credentialId = assertionResponse.id;
      const credentialRecord = credentialId
        ? await prisma.mfaCredential.findUnique({
            where: { credentialId },
          })
        : null;

      if (
        !credentialRecord ||
        credentialRecord.userId !== user.id ||
        credentialRecord.status !== "active"
      ) {
        throw notFound("passkey_not_found", "Passkey not registered");
      }

      const decoded = await decodePasskeyCredential(credentialRecord);
      const webauthnCredential: WebAuthnCredential = {
        id: credentialId!,
        publicKey: new Uint8Array(decoded.publicKey),
        counter: decoded.counter,
      };

      const verification = await verifyPasskeyAuthentication(
        user.id,
        assertionResponse,
        webauthnCredential,
      );
      if (!verification.verified) {
        throw unauthorized("passkey_invalid", "Authentication failed");
      }

      await updatePasskeyCounter(credentialId!, verification.authenticationInfo.newCounter);

      const sessionExpiry = grantStepUpSession(user.id);

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.passkey.verify",
        metadata: {
          credentialId,
        },
      });

      reply.send({
        status: "verified",
        session: {
          expiresAt: sessionExpiry.toISOString(),
        },
      });
    },
  );

  app.post(
    "/auth/mfa/reset",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;
      if (!userId) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      clearVerification(userId);

      reply.send({ status: "cleared" });
    },
  );
}
