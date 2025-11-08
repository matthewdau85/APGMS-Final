import type { FastifyBaseLogger } from "fastify";
import { createClient } from "redis";
import { connect, type ConnectionOptions, type NatsConnection } from "nats";

import { config } from "./config.js";

type RedisClient = ReturnType<typeof createClient>;

export type Providers = {
  redis: RedisClient | null;
  nats: NatsConnection | null;
};

export async function initProviders(
  logger: FastifyBaseLogger,
): Promise<Providers> {
  const providers: Providers = {
    redis: null,
    nats: null,
  };

  if (config.redis?.url) {
    const redisClient: RedisClient = createClient({ url: config.redis.url });
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

  if (config.nats?.url) {
    const options: ConnectionOptions = {
      servers: config.nats.url,
    };
    if (config.nats.token) {
      options.token = config.nats.token;
    }
    if (config.nats.username) {
      options.user = config.nats.username;
    }
    if (config.nats.password) {
      options.pass = config.nats.password;
    }

    try {
      const natsConnection = await connect(options);
      providers.nats = natsConnection;
      logger.info("nats_connected");
    } catch (error) {
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

  if (providers.nats) {
    try {
      await providers.nats.drain();
    } catch (error) {
      logger.error({ err: error }, "nats_drain_failed");
    } finally {
      try {
        await providers.nats.close();
      } catch (closeError) {
        logger.error({ err: closeError }, "nats_close_failed");
      }
    }
  }
}

