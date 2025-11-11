// services/api-gateway/src/providers.ts
import type { FastifyBaseLogger } from "fastify";
import { createClient, type RedisClientType } from "redis";

import { InMemoryEventBus } from "@apgms/shared/messaging/in-memory-bus.js";
import { NatsBus } from "@apgms/shared/messaging/nats-bus.js";
import type { EventBus } from "@apgms/shared/messaging/event-bus.js";

import { config } from "./config.js";

// Accept any-augmented redis client variants
type AnyRedisClient = RedisClientType<any, any, any>;

export type Providers = {
  redis: AnyRedisClient | null;
  eventBus: EventBus | null;
};

export async function initProviders(
  logger: FastifyBaseLogger,
): Promise<Providers> {
  const providers: Providers = {
    redis: null,
    eventBus: null,
  };

  if (config.redis?.url) {
    const redisClient = createClient({ url: config.redis.url }) as AnyRedisClient;
    redisClient.on("error", (err) => {
      logger.error({ err }, "redis_client_error");
    });

    try {
      await redisClient.connect();
      providers.redis = redisClient;
      logger.info("redis_connected");
    } catch (error) {
      logger.error({ err: error }, "redis_connection_failed");
    }
  }

  const fallbackBus = new InMemoryEventBus();
  providers.eventBus = fallbackBus;

  if (config.nats?.url) {
    try {
      const bus = await NatsBus.connect({
        url: config.nats.url,
        stream: config.nats.stream,
        subjectPrefix: config.nats.subjectPrefix,
        connectionName: "api-gateway",
      });
      providers.eventBus = bus;
      logger.info("nats_connected");
    } catch (error) {
      providers.eventBus = fallbackBus;
      logger.error({ err: error }, "nats_connection_failed");
    }
  }

  return providers;
}

export async function closeProviders(
  providers: Providers,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (providers.redis) {
    try {
      await providers.redis.quit();
    } catch (error) {
      logger.error({ err: error }, "redis_quit_failed");
    }
  }

  if (providers.eventBus && "close" in providers.eventBus) {
    const bus = providers.eventBus as unknown as {
      close?: () => Promise<void>;
    };
    if (bus.close) {
      try {
        await bus.close();
      } catch (error) {
        logger.error({ err: error }, "nats_close_failed");
      }
    }
  }
}
