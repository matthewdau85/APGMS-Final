import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
type BankLineRoutesDeps = {
    prisma: Pick<PrismaClient, "bankLine">;
};
export declare function createBankLinesPlugin(deps: BankLineRoutesDeps): FastifyPluginAsync;
export declare const registerBankLinesRoutes: FastifyPluginAsync;
export default registerBankLinesRoutes;
//# sourceMappingURL=bank-lines.d.ts.map