import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { conflict, notFound } from "@apgms/shared";
import { evaluateDesignatedAccountPolicy, normalizeTransferSource, } from "@apgms/shared/ledger";
async function ensureViolationAlert(prisma, orgId, message) {
    const existing = await prisma.alert.findFirst({
        where: {
            orgId,
            type: "DESIGNATED_WITHDRAWAL_ATTEMPT",
            severity: "HIGH",
            resolvedAt: null,
        },
    });
    if (existing) {
        return;
    }
    await prisma.alert.create({
        data: {
            orgId,
            type: "DESIGNATED_WITHDRAWAL_ATTEMPT",
            severity: "HIGH",
            message,
        },
    });
}
export async function applyDesignatedAccountTransfer(context, input) {
    const evaluation = evaluateDesignatedAccountPolicy({
        amount: input.amount,
        source: input.source,
    });
    if (!evaluation.allowed) {
        await ensureViolationAlert(context.prisma, input.orgId, evaluation.violation.message);
        if (context.auditLogger) {
            await context.auditLogger({
                orgId: input.orgId,
                actorId: input.actorId,
                action: "designatedAccount.violation",
                metadata: {
                    accountId: input.accountId,
                    amount: input.amount,
                    source: input.source,
                    violation: evaluation.violation.code,
                },
            });
        }
        throw conflict(evaluation.violation.code, evaluation.violation.message);
    }
    const normalizedSource = normalizeTransferSource(input.source);
    if (!normalizedSource) {
        // Defensive, should not happen given evaluation above.
        throw conflict("designated_untrusted_source", `Designated account funding source '${input.source}' is not whitelisted`);
    }
    const amountDecimal = new Prisma.Decimal(input.amount);
    const result = await context.prisma.$transaction(async (tx) => {
        const account = await tx.designatedAccount.findUnique({
            where: { id: input.accountId },
        });
        if (!account || account.orgId !== input.orgId) {
            throw notFound("designated_account_not_found", "Designated account not found for organisation");
        }
        const updatedBalance = account.balance.add(amountDecimal);
        await tx.designatedAccount.update({
            where: { id: account.id },
            data: {
                balance: updatedBalance,
                updatedAt: new Date(),
            },
        });
        const transfer = await tx.designatedTransfer.create({
            data: {
                orgId: input.orgId,
                accountId: account.id,
                amount: amountDecimal,
                source: normalizedSource,
            },
        });
        return {
            accountId: account.id,
            newBalance: Number(updatedBalance),
            transferId: transfer.id,
            source: normalizedSource,
        };
    });
    if (context.auditLogger) {
        await context.auditLogger({
            orgId: input.orgId,
            actorId: input.actorId,
            action: "designatedAccount.credit",
            metadata: {
                accountId: result.accountId,
                amount: input.amount,
                source: result.source,
                transferId: result.transferId,
            },
        });
    }
    return result;
}
export async function generateDesignatedAccountReconciliationArtifact(context, orgId, actorId = "system") {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const accounts = await context.prisma.designatedAccount.findMany({
        where: { orgId },
        include: {
            transfers: {
                where: {
                    createdAt: {
                        gte: cutoff,
                    },
                },
                orderBy: { createdAt: "asc" },
            },
        },
    });
    const movements = accounts.map((account) => {
        const inflow = account.transfers.reduce((acc, transfer) => {
            return acc + Number(transfer.amount);
        }, 0);
        return {
            accountId: account.id,
            type: account.type,
            balance: Number(account.balance),
            inflow24h: Number(inflow.toFixed(2)),
            transferCount24h: account.transfers.length,
        };
    });
    const totals = movements.reduce((acc, entry) => {
        if (entry.type.toUpperCase() === "PAYGW") {
            acc.paygw += entry.balance;
        }
        else if (entry.type.toUpperCase() === "GST") {
            acc.gst += entry.balance;
        }
        return acc;
    }, { paygw: 0, gst: 0 });
    const summary = {
        generatedAt: now.toISOString(),
        totals,
        movementsLast24h: movements,
    };
    const sha256 = createHash("sha256")
        .update(JSON.stringify(summary))
        .digest("hex");
    const artifact = await context.prisma.$transaction(async (tx) => {
        const created = await tx.evidenceArtifact.create({
            data: {
                orgId,
                kind: "designated-reconciliation",
                wormUri: "internal:designated/pending",
                sha256,
                payload: summary,
            },
        });
        return tx.evidenceArtifact.update({
            where: { id: created.id },
            data: {
                wormUri: `internal:designated/${created.id}`,
            },
        });
    });
    if (context.auditLogger) {
        await context.auditLogger({
            orgId,
            actorId,
            action: "designatedAccount.reconciliation",
            metadata: {
                artifactId: artifact.id,
                sha256,
                totals,
            },
        });
    }
    return {
        summary,
        artifactId: artifact.id,
        sha256,
    };
}
