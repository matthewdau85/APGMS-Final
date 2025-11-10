import type { ReplayProtectionStore, SignedPayload } from "../types.js";

export interface ReplayProtectionOptions {
  ttlSeconds?: number;
  store?: ReplayProtectionStore;
  clock?: () => number;
}

class MemoryReplayStore implements ReplayProtectionStore {
  private readonly entries = new Map<string, number>();

  async has(id: string): Promise<boolean> {
    return this.entries.has(id);
  }

  async store(id: string, expiresAt: number): Promise<void> {
    this.entries.set(id, expiresAt);
  }

  async purge(now: number = Date.now()): Promise<void> {
    for (const [id, expiresAt] of this.entries.entries()) {
      if (expiresAt <= now) {
        this.entries.delete(id);
      }
    }
  }
}

export class ReplayProtector {
  private readonly ttlMs: number;
  private readonly store: ReplayProtectionStore;
  private readonly clock: () => number;

  constructor(options: ReplayProtectionOptions = {}) {
    this.ttlMs = (options.ttlSeconds ?? 300) * 1000;
    this.store = options.store ?? new MemoryReplayStore();
    this.clock = options.clock ?? (() => Date.now());
  }

  async assertNotReplayed(message: SignedPayload): Promise<void> {
    await this.store.purge?.(this.clock());

    if (await this.store.has(message.id)) {
      throw new Error(`Replay detected for payload ${message.id}`);
    }

    const issuedAt = Date.parse(message.issuedAt);
    if (Number.isNaN(issuedAt)) {
      throw new Error("Invalid issuedAt timestamp on signed payload");
    }

    const expiresAt = Math.min(issuedAt + this.ttlMs, this.clock() + this.ttlMs);
    await this.store.store(message.id, expiresAt);
  }
}

