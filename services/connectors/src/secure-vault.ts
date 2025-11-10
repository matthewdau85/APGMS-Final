import { buildDefaultKmsManager, type EncryptionRecord } from "@apgms/shared";

export interface ConnectorSecret {
  clientId: string;
  clientSecret: string;
  webhookSigningKey?: string;
}

export interface ConnectorRecord {
  id: string;
  orgId: string;
  provider: string;
  credentials: ConnectorSecret;
  createdAt: Date;
  updatedAt: Date;
}

type StoredEnvelope = {
  orgId: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
  sealed: EncryptionRecord<{ orgId: string; connectorId: string }>;
};

export class SecureConnectorVault {
  private readonly kms = buildDefaultKmsManager();
  private readonly storage = new Map<string, StoredEnvelope>();

  async upsert(record: {
    id: string;
    orgId: string;
    provider: string;
    credentials: ConnectorSecret;
  }): Promise<void> {
    const now = new Date();
    const sealed = this.kms.encrypt({
      alias: "connectors",
      context: { orgId: record.orgId, connectorId: record.id },
      payload: record.credentials,
    });

    const previous = this.storage.get(record.id);

    this.storage.set(record.id, {
      orgId: record.orgId,
      provider: record.provider,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      sealed,
    });
  }

  async rotate(id: string): Promise<void> {
    const entry = this.storage.get(id);
    if (!entry) {
      throw new Error(`Connector ${id} not found`);
    }
    const rotated = this.kms.rotate(entry.sealed);
    this.storage.set(id, { ...entry, sealed: rotated, updatedAt: new Date() });
  }

  async get(id: string): Promise<ConnectorRecord | null> {
    const entry = this.storage.get(id);
    if (!entry) {
      return null;
    }
    const credentials = this.kms.decrypt<ConnectorSecret>("connectors", entry.sealed);
    return {
      id,
      orgId: entry.orgId,
      provider: entry.provider,
      credentials,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async listByOrg(orgId: string): Promise<ConnectorRecord[]> {
    const matches: ConnectorRecord[] = [];
    for (const [id, entry] of this.storage.entries()) {
      if (entry.orgId !== orgId) continue;
      const credentials = this.kms.decrypt<ConnectorSecret>("connectors", entry.sealed);
      matches.push({
        id,
        orgId: entry.orgId,
        provider: entry.provider,
        credentials,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }
    return matches;
  }
}

export function createSecureVault(): SecureConnectorVault {
  return new SecureConnectorVault();
}
