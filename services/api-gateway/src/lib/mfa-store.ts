import crypto from "node:crypto";
import type { InputJsonValue } from "@prisma/client/runtime/library.js";
import type { MfaCredential } from "@prisma/client";

import { prisma } from "../db.js";
import { sealObject, unsealObject, type EncryptionEnvelope } from "./encryption.js";

const TOTP_CONTEXT_PREFIX = "mfa:totp:";
const PASSKEY_CONTEXT_PREFIX = "mfa:passkey:";
interface TotpCredentialPayload {
  secret: string;
  recoveryCodes: Array<{
    hash: string;
    used: boolean;
  }>;
}

interface PasskeyCredentialPayload {
  publicKey: string;
  counter: number;
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function buildContext(prefix: string, userId: string): string {
  return `${prefix}${userId}`;
}

function envelopeFromRecord(record: MfaCredential): EncryptionEnvelope {
  return record.data as unknown as EncryptionEnvelope;
}

function toJson(envelope: EncryptionEnvelope): InputJsonValue {
  return envelope as unknown as InputJsonValue;
}

export async function getTotpCredential(userId: string): Promise<{
  secret: string;
  recoveryCodes: Array<{ hash: string; used: boolean }>;
  record: MfaCredential;
} | null> {
  const credential = await prisma.mfaCredential.findFirst({
    where: { userId, type: "totp", status: "active" },
  });
  if (!credential) {
    return null;
  }
  const payload = unsealObject<TotpCredentialPayload>(
    envelopeFromRecord(credential),
    buildContext(TOTP_CONTEXT_PREFIX, userId),
  );
  return {
    secret: payload.secret,
    recoveryCodes: payload.recoveryCodes,
    record: credential,
  };
}

export async function upsertTotpCredential(
  userId: string,
  secret: string,
  recoveryCodes: Array<{ hash: string; used: boolean }>,
): Promise<void> {
  const payload: TotpCredentialPayload = {
    secret,
    recoveryCodes,
  };
  const envelope = sealObject(payload, buildContext(TOTP_CONTEXT_PREFIX, userId));

  const existing = await prisma.mfaCredential.findFirst({
    where: { userId, type: "totp" },
  });

  if (existing) {
    await prisma.mfaCredential.update({
      where: { id: existing.id },
      data: {
        data: toJson(envelope),
        status: "active",
        primary: true,
        lastUsedAt: null,
      },
    });
    return;
  }

  await prisma.mfaCredential.create({
    data: {
      userId,
      type: "totp",
      primary: true,
      data: toJson(envelope),
    },
  });
}

export async function updateTotpRecoveryCodes(
  credentialId: string,
  userId: string,
  secret: string,
  recoveryCodes: Array<{ hash: string; used: boolean }>,
): Promise<void> {
  const envelope = sealObject(
    {
      secret,
      recoveryCodes,
    },
    buildContext(TOTP_CONTEXT_PREFIX, userId),
  );
  await prisma.mfaCredential.update({
    where: { id: credentialId },
    data: {
      data: toJson(envelope),
    },
  });
}

export async function recordMfaUsage(credentialId: string): Promise<void> {
  await prisma.mfaCredential.update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  });
}

export async function listPasskeyCredentials(userId: string): Promise<MfaCredential[]> {
  return prisma.mfaCredential.findMany({
    where: { userId, type: "webauthn", status: "active" },
  });
}

export async function savePasskeyCredential(
  userId: string,
  credentialId: string,
  publicKey: Buffer,
  counter: number,
): Promise<void> {
  const payload: PasskeyCredentialPayload = {
    publicKey: publicKey.toString("base64"),
    counter,
  };
  const envelope = sealObject(payload, buildContext(PASSKEY_CONTEXT_PREFIX, userId));

  const existing = await prisma.mfaCredential.findUnique({
    where: { credentialId },
  });

  if (existing) {
    await prisma.mfaCredential.update({
      where: { id: existing.id },
      data: {
        userId,
        data: toJson(envelope),
        status: "active",
      },
    });
    return;
  }

  await prisma.mfaCredential.create({
    data: {
      userId,
      type: "webauthn",
      credentialId,
      primary: false,
      data: toJson(envelope),
    },
  });
}

export async function updatePasskeyCounter(
  credentialId: string,
  counter: number,
): Promise<void> {
  const record = await prisma.mfaCredential.findUnique({
    where: { credentialId },
  });
  if (!record) {
    return;
  }
  const payload = unsealObject<PasskeyCredentialPayload>(
    envelopeFromRecord(record),
    buildContext(PASSKEY_CONTEXT_PREFIX, record.userId),
  );
  payload.counter = counter;
  const updated = sealObject(payload, buildContext(PASSKEY_CONTEXT_PREFIX, record.userId));
  await prisma.mfaCredential.update({
    where: { id: record.id },
    data: {
      data: toJson(updated),
      lastUsedAt: new Date(),
    },
  });
}

export async function decodePasskeyCredential(
  record: MfaCredential,
): Promise<{ publicKey: Buffer; counter: number }> {
  const payload = unsealObject<PasskeyCredentialPayload>(
    envelopeFromRecord(record),
    buildContext(PASSKEY_CONTEXT_PREFIX, record.userId),
  );
  return {
    publicKey: Buffer.from(payload.publicKey, "base64"),
    counter: payload.counter,
  };
}

export async function hasPasskey(userId: string): Promise<boolean> {
  const count = await prisma.mfaCredential.count({
    where: { userId, type: "webauthn", status: "active" },
  });
  return count > 0;
}

export async function disableTotp(userId: string): Promise<void> {
  await prisma.mfaCredential.updateMany({
    where: { userId, type: "totp" },
    data: { status: "revoked" },
  });
}

export async function hasTotp(userId: string): Promise<boolean> {
  const count = await prisma.mfaCredential.count({
    where: { userId, type: "totp", status: "active" },
  });
  return count > 0;
}
