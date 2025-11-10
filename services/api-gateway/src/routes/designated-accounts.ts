import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { assertOrgAccess } from "../utils/orgScope.js";
import { recordAuditLog } from "../lib/audit.js";
import { applyDesignatedAccountTransfer } from "../../../../domain/policy/designated-accounts.js";

const depositSchema = z.object({
  amountCents: z.number().int().positive(),
  source: z.string().min(1),
});

function redactDesignatedAccount(account: any) {
  return {
    id: account.id,
    type: account.type,
    balance: Number(account.balance ?? 0),
    updatedAt: account.updatedAt,
    depositOnly: account.depositOnly,
    pendingReconciliations: account.reconciliations?.filter((rec: any) => rec.status === "PENDING").length ?? 0,
    lastReconciledAt:
      account.reconciliations?.filter((rec: any) => rec.status !== "PENDING").sort(
        (a: any, b: any) => new Date(b.reconciledAt ?? 0).getTime() - new Date(a.reconciledAt ?? 0).getTime(),
      )[0]?.reconciledAt ?? null,
  };
}

export const registerDesignatedAccountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/designated-accounts", async (req, reply) => {
    const user = (req as any).user;
    assertOrgAccess(req, reply, user.orgId);

    const accounts = await prisma.designatedAccount.findMany({
      where: { orgId: user.orgId },
      include: {
        reconciliations: {
          orderBy: { recordedAt: "desc" },
          take: 10,
        },
      },
    });

    reply.send({
      accounts: accounts.map(redactDesignatedAccount),
    });
  });

  app.post("/designated-accounts/:accountId/deposits", async (req, reply) => {
    const user = (req as any).user;
    assertOrgAccess(req, reply, user.orgId);

    const accountId = (req.params as any).accountId as string;
    const parsed = depositSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const deposit = parsed.data;

    const actorId = (user.id ?? user.email ?? user.orgId) as string;

    const result = await applyDesignatedAccountTransfer(
      {
        prisma,
        auditLogger: async (entry: {
          orgId: string;
          actorId: string;
          action: string;
          metadata: Record<string, unknown>;
        }) => {
          await recordAuditLog({
            orgId: entry.orgId,
            actorId: entry.actorId,
            action: entry.action,
            metadata: entry.metadata,
          });
        },
      },
      {
        orgId: user.orgId,
        accountId,
        amount: deposit.amountCents / 100,
        source: deposit.source,
        actorId,
      },
    );

    reply.code(201).send({
      transferId: result.transferId,
      accountId: result.accountId,
      newBalance: result.newBalance,
    });
  });
};

export default registerDesignatedAccountRoutes;
