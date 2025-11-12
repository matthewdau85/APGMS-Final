import type { FastifyBaseLogger } from "fastify";
import type { RedisClientType } from "redis";

import type {
  DetectorMuteReason,
  DetectorMuteScope,
} from "@apgms/shared/alerts/muting.js";
import type {
  DetectorCacheInvalidationEvent,
  DetectorNightlyEvent,
  LedgerCompactionEvent,
} from "@apgms/events";
import {
  DETECTOR_NIGHTLY_SUBJECT,
  LEDGER_COMPACTION_SUBJECT,
  mapLedgerCompactionToInvalidation,
  mapNightlyToInvalidation,
} from "@apgms/events";
import type { EventBus } from "@apgms/shared/messaging/event-bus.js";

const CACHE_PREFIX = "detector:mute";
const INDEX_PREFIX = "detector:mute:index";

export type DetectorMuteCacheKey = {
  tenantId: string;
  streamId: string;
  period: string;
};

export type DetectorMuteCacheEntry = {
  muted: boolean;
  reason: DetectorMuteReason;
  muteId?: string | null;
  scope?: DetectorMuteScope | null;
  expiresAt?: string | null;
  evaluatedAt: string;
};

type CacheOptions = {
  redis?: RedisClientType<any, any, any> | null;
  ttlSeconds?: number;
  logger?: FastifyBaseLogger;
};

const cacheKey = (key: DetectorMuteCacheKey): string =>
  `${CACHE_PREFIX}:${key.tenantId}:${key.streamId}:${key.period}`;

const indexKey = (tenantId: string): string => `${INDEX_PREFIX}:${tenantId}`;

const matchesStream = (rawKey: string, streamId: string): boolean => {
  const parts = rawKey.split(":");
  const targetStream = parts[3];
  return targetStream === streamId;
};

export class DetectorMuteCache {
  private readonly redis?: RedisClientType<any, any, any> | null;
  private readonly ttlSeconds: number;
  private readonly logger?: FastifyBaseLogger;
  private readonly memory = new Map<string, DetectorMuteCacheEntry>();
  private readonly tenantIndex = new Map<string, Set<string>>();

  constructor(options: CacheOptions = {}) {
    this.redis = options.redis ?? undefined;
    this.ttlSeconds = options.ttlSeconds ?? 3600;
    this.logger = options.logger;
  }

  async get(key: DetectorMuteCacheKey): Promise<DetectorMuteCacheEntry | null> {
    const redisKey = cacheKey(key);
    if (this.redis) {
      try {
        const raw = await this.redis.get(redisKey);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw) as DetectorMuteCacheEntry;
      } catch (error) {
        this.logger?.warn({ err: error }, "detector_mute_cache_get_failed");
      }
    }

    return this.memory.get(redisKey) ?? null;
  }

  async set(key: DetectorMuteCacheKey, entry: DetectorMuteCacheEntry): Promise<void> {
    const redisKey = cacheKey(key);
    const index = indexKey(key.tenantId);
    if (this.redis) {
      try {
        await this.redis.set(redisKey, JSON.stringify(entry), {
          EX: this.ttlSeconds,
        });
        await this.redis.sAdd(index, redisKey);
        return;
      } catch (error) {
        this.logger?.warn({ err: error }, "detector_mute_cache_set_failed");
      }
    }

    this.memory.set(redisKey, entry);
    const tenantKeys = this.tenantIndex.get(key.tenantId) ?? new Set<string>();
    tenantKeys.add(redisKey);
    this.tenantIndex.set(key.tenantId, tenantKeys);
  }

  async invalidate(key: DetectorMuteCacheKey): Promise<void> {
    const redisKey = cacheKey(key);
    const index = indexKey(key.tenantId);
    if (this.redis) {
      try {
        await this.redis.del(redisKey);
        await this.redis.sRem(index, redisKey);
      } catch (error) {
        this.logger?.warn({ err: error }, "detector_mute_cache_invalidate_failed");
      }
    }
    this.memory.delete(redisKey);
    const tenantKeys = this.tenantIndex.get(key.tenantId);
    tenantKeys?.delete(redisKey);
  }

  async invalidateStream(tenantId: string, streamId: string): Promise<void> {
    const redisIndex = indexKey(tenantId);
    if (this.redis) {
      try {
        const members = await this.redis.sMembers(redisIndex);
        const matching = members.filter((member) => matchesStream(member, streamId));
        if (matching.length > 0) {
          await this.redis.del(...matching);
          await this.redis.sRem(redisIndex, ...matching);
        }
      } catch (error) {
        this.logger?.warn({ err: error }, "detector_mute_cache_stream_invalidate_failed");
      }
    }

    const tenantKeys = this.tenantIndex.get(tenantId);
    if (tenantKeys) {
      for (const value of Array.from(tenantKeys)) {
        if (matchesStream(value, streamId)) {
          tenantKeys.delete(value);
          this.memory.delete(value);
        }
      }
      if (tenantKeys.size === 0) {
        this.tenantIndex.delete(tenantId);
      }
    }
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    const redisIndex = indexKey(tenantId);
    if (this.redis) {
      try {
        const members = await this.redis.sMembers(redisIndex);
        if (members.length > 0) {
          await this.redis.del(...members);
        }
        await this.redis.del(redisIndex);
      } catch (error) {
        this.logger?.warn({ err: error }, "detector_mute_cache_tenant_invalidate_failed");
      }
    }

    const tenantKeys = this.tenantIndex.get(tenantId);
    if (tenantKeys) {
      for (const value of tenantKeys) {
        this.memory.delete(value);
      }
      this.tenantIndex.delete(tenantId);
    }
  }
}

type InvalidationHandler = (event: DetectorCacheInvalidationEvent) => Promise<void>;

const createInvalidationHandler = (cache: DetectorMuteCache): InvalidationHandler =>
  async (event) => {
    const { tenantId, streamId, period } = event;
    if (streamId && period) {
      await cache.invalidate({ tenantId, streamId, period });
      return;
    }
    if (streamId) {
      await cache.invalidateStream(tenantId, streamId);
      return;
    }
    await cache.invalidateTenant(tenantId);
  };

export type RegisterInvalidationOptions = {
  cache: DetectorMuteCache;
  bus?: EventBus | null;
  logger?: FastifyBaseLogger;
};

export async function registerDetectorCacheInvalidation(
  options: RegisterInvalidationOptions,
): Promise<Array<() => Promise<void>>> {
  const { cache, bus, logger } = options;
  if (!bus) {
    logger?.warn("detector mute cache invalidation bus unavailable");
    return [];
  }

  const handler = createInvalidationHandler(cache);

  const nightlyUnsubscribe = await bus.subscribe(
    DETECTOR_NIGHTLY_SUBJECT,
    "detector-mute-cache-nightly",
    async (message) => {
      const payload = message.payload as DetectorNightlyEvent;
      await handler(mapNightlyToInvalidation(payload));
    },
  );

  const ledgerUnsubscribe = await bus.subscribe(
    LEDGER_COMPACTION_SUBJECT,
    "detector-mute-cache-ledger",
    async (message) => {
      const payload = message.payload as LedgerCompactionEvent;
      await handler(mapLedgerCompactionToInvalidation(payload));
    },
  );

  logger?.info("detector mute cache invalidation listeners registered");

  return [nightlyUnsubscribe, ledgerUnsubscribe];
}
