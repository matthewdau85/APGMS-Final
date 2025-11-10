import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes, generateKeyPairSync, createHash } from "node:crypto";

import { prisma } from "@apgms/shared/db.js";

const SYSTEM_ACTOR = "key-automation";

async function recordAuditLog(orgId: string, metadata: Record<string, unknown>) {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const createdAt = new Date();
  const payload = JSON.stringify({ orgId, actorId: SYSTEM_ACTOR, action: "security.keys.rotated", metadata, createdAt });
  const prevHash = previous?.hash ?? null;
  const hash = createHash("sha256").update(payload + (prevHash ?? "")).digest("hex");

  await prisma.auditLog.create({
    data: {
      orgId,
      actorId: SYSTEM_ACTOR,
      action: "security.keys.rotated",
      metadata,
      createdAt,
      hash,
      prevHash,
    },
  });
}

export async function runAutomatedKeyRotation(): Promise<void> {
  const orgs = await prisma.org.findMany({ select: { id: true } });
  const artifactDir = resolve("artifacts", "kms");
  mkdirSync(artifactDir, { recursive: true });

  for (const org of orgs) {
    const keyMaterial = randomBytes(32).toString("base64");
    const saltMaterial = randomBytes(32).toString("base64");
    const keyId = `kid-${Date.now()}`;
    const saltId = `sid-${Date.now()}`;

    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const publicJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    publicJwk.kid = keyId;
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    const rotationRecord = {
      orgId: org.id,
      generatedAt: new Date().toISOString(),
      jwt: { jwk: publicJwk },
      pii: {
        activeKey: keyId,
        material: keyMaterial,
        activeSalt: saltId,
        saltMaterial,
      },
    };

    const filename = join(artifactDir, `rotation-${org.id}-${Date.now()}.json`);
    writeFileSync(filename, JSON.stringify(rotationRecord, null, 2), "utf8");
    writeFileSync(`${filename}.key`, privatePem, "utf8");

    await prisma.forensicLog.create({
      data: {
        orgId: org.id,
        category: "key_rotation",
        message: "Automated key rotation executed and escrowed",
        payload: {
          artifact: filename,
          keyId,
          saltId,
        },
      },
    });

    await recordAuditLog(org.id, {
      keyId,
      saltId,
      artifact: filename,
    });
  }
}

export default runAutomatedKeyRotation;
