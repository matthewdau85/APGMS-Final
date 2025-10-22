import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import type { PrismaClient } from "@prisma/client";
import type {
  AuditLogger,
  EncryptionKey,
  KeyManagementService,
  SaltMaterial,
  TokenSaltProvider,
} from "../lib/pii";

interface RawKeyMaterial {
  kid: string;
  material: string;
}

interface RawSaltMaterial {
  sid: string;
  secret: string;
}

function decodeKeyMaterial(raw: RawKeyMaterial): EncryptionKey {
  return {
    kid: raw.kid,
    material: Buffer.from(raw.material, "base64"),
  };
}

class EnvKeyManagementService implements KeyManagementService {
  private readonly keys = new Map<string, EncryptionKey>();
  private readonly activeKid: string;

  constructor(rawKeys: RawKeyMaterial[], activeKid: string | undefined) {
    if (rawKeys.length === 0) {
      throw new Error("PII_KEYS must provide at least one key");
    }
    for (const raw of rawKeys) {
      if (!raw.kid || !raw.material) {
        throw new Error("PII_KEYS entries require kid and material");
      }
      this.keys.set(raw.kid, decodeKeyMaterial(raw));
    }
    this.activeKid = activeKid ?? rawKeys[0]!.kid;
    if (!this.keys.has(this.activeKid)) {
      throw new Error(`PII_ACTIVE_KEY ${this.activeKid} missing from key set`);
    }
  }

  getActiveKey(): EncryptionKey {
    const key = this.keys.get(this.activeKid);
    if (!key) {
      throw new Error(`Active key ${this.activeKid} is not available`);
    }
    return key;
  }

  getKeyById(kid: string): EncryptionKey | undefined {
    return this.keys.get(kid);
  }
}

class EnvSaltProvider implements TokenSaltProvider {
  private readonly salts = new Map<string, SaltMaterial>();
  private readonly activeSid: string;

  constructor(rawSalts: RawSaltMaterial[], activeSid: string | undefined) {
    if (rawSalts.length === 0) {
      // generate ephemeral salt to avoid crashes, but warn
      const sid = `ephemeral-${Date.now()}`;
      const secret = randomBytes(32);
      this.salts.set(sid, { sid, secret });
      this.activeSid = sid;
      return;
    }

    for (const raw of rawSalts) {
      if (!raw.sid || !raw.secret) {
        throw new Error("PII_SALTS entries require sid and secret");
      }
      this.salts.set(raw.sid, {
        sid: raw.sid,
        secret: Buffer.from(raw.secret, "base64"),
      });
    }
    this.activeSid = activeSid ?? rawSalts[0]!.sid;
    if (!this.salts.has(this.activeSid)) {
      throw new Error(`PII_ACTIVE_SALT ${this.activeSid} missing from salt set`);
    }
  }

  getActiveSalt(): SaltMaterial {
    const salt = this.salts.get(this.activeSid);
    if (!salt) {
      throw new Error("Active salt is not available");
    }
    return salt;
  }

  getSaltById(id: string): SaltMaterial | undefined {
    return this.salts.get(id);
  }
}

class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async record(event: Parameters<AuditLogger["record"]>[0]): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: event.actorId,
          action: event.action,
          orgId: (event.metadata?.orgId as string | undefined) ?? "unknown",
          metadata: event.metadata ?? {},
        },
      });
    } catch (error) {
      // Failing closed to avoid leaking operations; log and continue
      console.error("unable to persist audit log", error);
      throw error;
    }
  }
}

export interface ProviderConfig {
  prisma: PrismaClient;
}

export function createKeyManagementService(): KeyManagementService {
  const rawKeys = parseJsonEnv<RawKeyMaterial[]>(process.env.PII_KEYS, "PII_KEYS") ?? [];
  const activeKid = process.env.PII_ACTIVE_KEY;
  return new EnvKeyManagementService(rawKeys, activeKid);
}

export function createSaltProvider(): TokenSaltProvider {
  const rawSalts = parseJsonEnv<RawSaltMaterial[]>(process.env.PII_SALTS, "PII_SALTS") ?? [];
  const activeSid = process.env.PII_ACTIVE_SALT;
  return new EnvSaltProvider(rawSalts, activeSid);
}

export function createAuditLogger(prisma: PrismaClient): AuditLogger {
  return new PrismaAuditLogger(prisma);
}

function parseJsonEnv<T>(value: string | undefined, name: string): T | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`${name} must contain valid JSON`);
  }
}
