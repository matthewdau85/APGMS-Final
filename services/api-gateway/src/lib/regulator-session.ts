import crypto from "node:crypto";

import { prisma } from "../db.js";

export async function createRegulatorSession(orgId: string, ttlMinutes: number) {
  const seed = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(seed).digest("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60 * 1000);

  const session = await prisma.regulatorSession.create({
    data: {
      orgId,
      tokenHash,
      issuedAt,
      expiresAt,
      lastUsedAt: issuedAt,
    },
  });

  return {
    session,
    sessionToken: seed,
  };
}

export async function ensureRegulatorSessionActive(sessionId: string) {
  const session = await prisma.regulatorSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("regulator_session_not_found");
  }

  if (session.revokedAt) {
    throw new Error("regulator_session_revoked");
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw new Error("regulator_session_expired");
  }

  await prisma.regulatorSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return session;
}

export async function revokeRegulatorSession(sessionId: string) {
  await prisma.regulatorSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
