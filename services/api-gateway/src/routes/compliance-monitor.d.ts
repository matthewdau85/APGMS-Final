import type { FastifyPluginAsync } from "fastify";
/**
 * Temporary stub for the compliance monitor routes.
 *
 * The previous version imported deep internals from "@apgms/shared/ledger/ingest.js",
 * which are not exposed via the package's "exports" map. That caused
 * ERR_PACKAGE_PATH_NOT_EXPORTED at runtime when starting the API.
 *
 * This stub keeps the router wired into app.ts without relying on any
 * non-exported subpaths. You can expand this later using only public
 * shared exports or by introducing a proper internal module import.
 */
export declare const registerComplianceMonitorRoutes: FastifyPluginAsync;
//# sourceMappingURL=compliance-monitor.d.ts.map