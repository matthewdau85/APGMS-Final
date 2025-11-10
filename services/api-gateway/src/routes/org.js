import { prisma } from "../db.js";
import { authGuard } from "../auth.js";
import { enforceAdminStepUp } from "../security/step-up.js";
export const registerOrgRoutes = async (app) => {
    app.get("/org/obligations/current", { preHandler: authGuard }, async (request, reply) => {
        if (!enforceAdminStepUp(request, reply, "org.obligations.read")) {
            return;
        }
        const user = request.user;
        const basCycle = await prisma.basCycle.findFirst({
            where: { orgId: user.orgId },
            orderBy: { periodStart: "desc" },
        });
        const paygwRequired = basCycle ? Number(basCycle.paygwRequired) : 0;
        const paygwSecured = basCycle ? Number(basCycle.paygwSecured) : 0;
        const gstRequired = basCycle ? Number(basCycle.gstRequired) : 0;
        const gstSecured = basCycle ? Number(basCycle.gstSecured) : 0;
        const paygwShortfall = Math.max(0, paygwRequired - paygwSecured);
        const gstShortfall = Math.max(0, gstRequired - gstSecured);
        reply.send({
            basCycleId: basCycle?.id ?? null,
            basPeriodStart: basCycle?.periodStart.toISOString() ?? new Date().toISOString(),
            basPeriodEnd: basCycle?.periodEnd.toISOString() ?? new Date().toISOString(),
            paygw: {
                required: paygwRequired,
                secured: paygwSecured,
                shortfall: paygwShortfall,
                status: paygwShortfall === 0 ? "secured" : "shortfall",
            },
            gst: {
                required: gstRequired,
                secured: gstSecured,
                shortfall: gstShortfall,
                status: gstShortfall === 0 ? "secured" : "shortfall",
            },
            nextBasDue: basCycle?.lodgedAt == null ? basCycle?.periodEnd.toISOString() ?? null : null,
        });
    });
    app.get("/org/designated-accounts", { preHandler: authGuard }, async (request, reply) => {
        if (!enforceAdminStepUp(request, reply, "org.designated.read")) {
            return;
        }
        const user = request.user;
        const accounts = await prisma.designatedAccount.findMany({
            where: { orgId: user.orgId },
            include: {
                transfers: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
            },
        });
        const totals = accounts.reduce((agg, account) => {
            const balance = Number(account.balance);
            if (account.type.toUpperCase() === "PAYGW") {
                agg.paygw += balance;
            }
            else if (account.type.toUpperCase() === "GST") {
                agg.gst += balance;
            }
            return agg;
        }, { paygw: 0, gst: 0 });
        reply.send({
            totals,
            accounts: accounts.map((account) => ({
                id: account.id,
                type: account.type,
                balance: Number(account.balance),
                updatedAt: account.updatedAt.toISOString(),
                transfers: account.transfers.map((transfer) => ({
                    id: transfer.id,
                    amount: Number(transfer.amount),
                    source: transfer.source,
                    createdAt: transfer.createdAt.toISOString(),
                })),
            })),
        });
    });
};
export default registerOrgRoutes;
