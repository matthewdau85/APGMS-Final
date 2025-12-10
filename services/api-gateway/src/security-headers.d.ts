import type { FastifyHelmetOptions } from "@fastify/helmet";
import type { AppConfig } from "./config.js";
/**
 * Build a helmet configuration for the given app config.
 * This is what the app and tests should use.
 */
export declare function helmetConfigFor(config: AppConfig): FastifyHelmetOptions;
/**
 * Back-compat alias for older tests.
 * test/regulator-compliance-summary.test.ts imports this by name.
 */
export declare function buildHelmetConfig(config: AppConfig): FastifyHelmetOptions;
//# sourceMappingURL=security-headers.d.ts.map