export interface EncryptionKey {
  kid: string;
  material: Buffer;
}

export interface KeyManagementService {
  getActiveKey(): EncryptionKey;
  getKeyById(kid: string): EncryptionKey | undefined;
}

export interface SaltMaterial {
  sid: string;
  secret: Buffer;
}

export interface TokenSaltProvider {
  getActiveSalt(): SaltMaterial;
  getSaltById(id: string): SaltMaterial | undefined;
}

export interface AuditEvent {
  actorId: string;
  action: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  record(event: AuditEvent): void | Promise<void>;
}
