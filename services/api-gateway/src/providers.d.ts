import type { FastifyBaseLogger } from "fastify";
import { type RedisClientType } from "redis";
import { type NatsConnection } from "nats";
type AnyRedisClient = RedisClientType<any, any, any>;
export type Providers = {
    redis: AnyRedisClient | null;
    nats: NatsConnection | null;
};
export declare function initProviders(logger: FastifyBaseLogger): Promise<Providers>;
export declare function closeProviders(providers: Providers, logger: FastifyBaseLogger): Promise<void>;
export {};
//# sourceMappingURL=providers.d.ts.map