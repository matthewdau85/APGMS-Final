import { buildDefaultKmsManager } from "@apgms/shared";
export class SecureConnectorVault {
    kms = buildDefaultKmsManager();
    storage = new Map();
    async upsert(record) {
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
    async rotate(id) {
        const entry = this.storage.get(id);
        if (!entry) {
            throw new Error(`Connector ${id} not found`);
        }
        const rotated = this.kms.rotate(entry.sealed);
        this.storage.set(id, { ...entry, sealed: rotated, updatedAt: new Date() });
    }
    async get(id) {
        const entry = this.storage.get(id);
        if (!entry) {
            return null;
        }
        const credentials = this.kms.decrypt("connectors", entry.sealed);
        return {
            id,
            orgId: entry.orgId,
            provider: entry.provider,
            credentials,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        };
    }
    async listByOrg(orgId) {
        const matches = [];
        for (const [id, entry] of this.storage.entries()) {
            if (entry.orgId !== orgId)
                continue;
            const credentials = this.kms.decrypt("connectors", entry.sealed);
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
export function createSecureVault() {
    return new SecureConnectorVault();
}
