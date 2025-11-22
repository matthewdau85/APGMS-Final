// services/api-gateway/src/routes/onboarding.ts

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify";
import type { PrismaClient } from "@prisma/client";

type OnboardBody = {
  abn: string;
  legalName: string;
  designatedAccounts: Array<{
    kind: "PAYGW" | "GST" | "BAS_ESCROW" | string;
    bsb: string;
    accountNumber: string;
    displayName?: string;
  }>;
};

export const registerOnboardingRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
): Promise<void> => {
  const prisma = (app as any).prisma as PrismaClient;

  app.post(
    "/onboarding/org",
    async (request: FastifyRequest<{ Body: OnboardBody }>, reply) => {
      const { abn, legalName, designatedAccounts } = request.body;
      const db: any = prisma as any;

      const orgWhere: any = { abn };
      const orgUpdate: any = { legalName };
      const orgCreate: any = { abn, legalName };

      const org = await db.organization.upsert({
        where: orgWhere,
        update: orgUpdate,
        create: orgCreate,
      });

      for (const account of designatedAccounts) {
        const designatedData: any = {
          orgId: org.id,
          kind: account.kind,
          bsb: account.bsb,
          accountNumber: account.accountNumber,
          displayName: account.displayName ?? account.kind,
        };

        await db.designatedAccount.create({
          data: designatedData,
        });
      }

      // Obligation settings shim – tolerate missing model
      if (db.obligationSetting?.upsert) {
        await db.obligationSetting.upsert({
          where: {
            orgId: org.id,
          } as any,
          update: {
            orgId: org.id,
          } as any,
          create: {
            orgId: org.id,
          } as any,
        });
      }

      return reply.send({ orgId: org.id });
    },
  );
};
