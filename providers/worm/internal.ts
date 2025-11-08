import {
  MILLIS_PER_DAY,
  createContentAddressedUri,
  type WormAttestation,
  type WormAttestationInput,
  type WormLockState,
  type WormProvider,
} from "./types.js";

const DEFAULT_LOCK_STATE: WormLockState = "locked";

export class InternalWormProvider implements WormProvider {
  public readonly id: string;

  constructor(id = "internal") {
    this.id = id;
  }

  async issueAttestation(input: WormAttestationInput): Promise<WormAttestation> {
    const retentionUntil = Number.isFinite(input.retentionDays)
      ? new Date(input.createdAt.getTime() + input.retentionDays * MILLIS_PER_DAY).toISOString()
      : null;

    return {
      providerId: this.id,
      scope: input.scope,
      uri: createContentAddressedUri(input.scope, input.sha256),
      sha256: input.sha256,
      lockState: DEFAULT_LOCK_STATE,
      retentionUntil,
    };
  }

  async close(): Promise<void> {
    // no-op for in-memory provider
  }
}
