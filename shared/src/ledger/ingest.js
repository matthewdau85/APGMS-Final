// shared/src/ledger/ingest.ts
import { Decimal } from "@prisma/client/runtime/library";
import { withIdempotency } from "../idempotency.js";
import { getDesignatedAccountByType } from "./designated-account.js";
const PAYROLL_SOURCE = "payroll_system";
const POS_SOURCE = "pos_system";
export async function recordPayrollContribution(params) {
    await withIdempotency({
        headers: params.idempotencyKey
            ? { "Idempotency-Key": params.idempotencyKey }
            : undefined,
    }, null, {
        prisma: params.prisma,
        orgId: params.orgId,
        requestPayload: {
            amount: params.amount,
            type: PAYROLL_SOURCE,
            payload: params.payload,
        },
        resource: "payrollContribution",
    }, async ({ idempotencyKey }) => {
        await params.prisma.payrollContribution.create({
            data: {
                orgId: params.orgId,
                amount: new Decimal(params.amount),
                source: PAYROLL_SOURCE,
                // Avoid null for JSON – cast to InputJsonValue/undefined
                payload: params.payload,
                actorId: params.actorId,
                idempotencyKey,
            },
        });
        return { ok: true };
    });
}
export async function recordPosTransaction(params) {
    await withIdempotency({
        headers: params.idempotencyKey
            ? { "Idempotency-Key": params.idempotencyKey }
            : undefined,
    }, null, {
        prisma: params.prisma,
        orgId: params.orgId,
        requestPayload: {
            amount: params.amount,
            type: POS_SOURCE,
            payload: params.payload,
        },
        resource: "posTransaction",
    }, async ({ idempotencyKey }) => {
        await params.prisma.posTransaction.create({
            data: {
                orgId: params.orgId,
                amount: new Decimal(params.amount),
                source: POS_SOURCE,
                payload: params.payload,
                actorId: params.actorId,
                idempotencyKey,
            },
        });
        return { ok: true };
    });
}
export async function applyPendingContributions(params) {
    const pendingPayroll = await params.prisma.payrollContribution.findMany({
        where: { orgId: params.orgId, appliedAt: null },
        orderBy: { createdAt: "asc" },
    });
    const pendingPos = await params.prisma.posTransaction.findMany({
        where: { orgId: params.orgId, appliedAt: null },
        orderBy: { createdAt: "asc" },
    });
    const context = {
        prisma: params.prisma,
        auditLogger: params.auditLogger,
        applyTransfer: params.applyTransfer,
    };
    for (const contribution of pendingPayroll) {
        await applyContribution(contribution, {
            orgId: params.orgId,
            accountType: "PAYGW_BUFFER",
            actorId: params.actorId ?? contribution.actorId ?? "system",
            context,
            table: "payroll",
        });
    }
    for (const contribution of pendingPos) {
        await applyContribution(contribution, {
            orgId: params.orgId,
            accountType: "GST_BUFFER",
            actorId: params.actorId ?? contribution.actorId ?? "system",
            context,
            table: "pos",
        });
    }
    return {
        payrollApplied: pendingPayroll.length,
        posApplied: pendingPos.length,
    };
}
async function applyContribution(contribution, params) {
    const account = await getDesignatedAccountByType(params.context.prisma, params.orgId, params.accountType);
    const transfer = await params.context.applyTransfer({
        prisma: params.context.prisma,
        auditLogger: params.context.auditLogger,
    }, {
        orgId: params.orgId,
        accountId: account.id,
        amount: Number(contribution.amount),
        source: contribution.source,
        actorId: params.actorId,
    });
    const update = params.table === "payroll"
        ? params.context.prisma.payrollContribution.update({
            where: { id: contribution.id },
            data: {
                appliedAt: new Date(),
                transferId: transfer.transferId,
            },
        })
        : params.context.prisma.posTransaction.update({
            where: { id: contribution.id },
            data: {
                appliedAt: new Date(),
                transferId: transfer.transferId,
            },
        });
    await update;
}
export async function summarizeContributions(prisma, orgId) {
    const payrollSummary = await prisma.payrollContribution.aggregate({
        _sum: { amount: true },
        where: { orgId, appliedAt: { not: null } },
    });
    const posSummary = await prisma.posTransaction.aggregate({
        _sum: { amount: true },
        where: { orgId, appliedAt: { not: null } },
    });
    return {
        paygwSecured: Number(payrollSummary._sum.amount ?? 0),
        gstSecured: Number(posSummary._sum.amount ?? 0),
    };
}
//# sourceMappingURL=ingest.js.map