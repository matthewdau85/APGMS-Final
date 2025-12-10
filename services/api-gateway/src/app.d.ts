import { FastifyInstance, FastifyPluginAsync } from "fastify";
import "dotenv/config.js";
type BuildServerOptions = {
    bankLinesPlugin?: FastifyPluginAsync;
};
export declare function buildServer(options?: BuildServerOptions): Promise<FastifyInstance>;
export declare function createApp(options?: BuildServerOptions): Promise<FastifyInstance>;
export {};
//# sourceMappingURL=app.d.ts.map