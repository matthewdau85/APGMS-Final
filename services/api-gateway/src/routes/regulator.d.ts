import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { recordAuditLog } from "../lib/audit.js";
type RegulatorRoutesDeps = {
    prisma?: PrismaClient;
    auditLogger?: typeof recordAuditLog;
};
export declare function registerRegulatorRoutes(app: FastifyInstance, deps?: RegulatorRoutesDeps): Promise<void>;
export {};
//# sourceMappingURL=regulator.d.ts.map