// services/connectors/src/index.ts
// Thin orchestration layer for POS/bank capture into designated accounts.
//
// IMPORTANT:
// - This file is intentionally self-contained so that @apgms/connectors
//   does not depend directly on @apgms/domain-policy or @apgms/api-gateway.
// - Real designated-account behaviour is injected via ConnectorDependencies.
// - The default implementation is a safe stub that allows the monorepo to build.
/**
 * Default dependencies – currently STUBBED so the package can build in isolation.
 *
 * These are safe no-op style implementations that preserve the public API shape.
 * Replace them with real functions when you’re ready to wire in the domain logic.
 */
const DEFAULT_DEPS = {
    async applyTransfer({ orgId, captureId, amountCents, currency }) {
        // Stub implementation: pretend we wrote a journal entry.
        return {
            journalId: `stub:${orgId}:${captureId}:${currency}:${amountCents}`,
        };
    },
    async generateReconciliation({ orgId, captureId, transferJournalId }) {
        // Stub implementation: echo back a minimal summary.
        return {
            orgId,
            captureId,
            transferJournalId,
        };
    },
};
/**
 * Core orchestration function:
 * 1) Persist the raw capture event.
 * 2) Apply designated-account transfer.
 * 3) Generate reconciliation artifact.
 * 4) Emit audit log entry (if an audit logger is provided).
 */
export async function runCapture(context, input, reason, deps = DEFAULT_DEPS) {
    const { prisma, auditLogger } = context;
    const { applyTransfer, generateReconciliation } = deps;
    // 1) Persist the raw capture event (POS, bank feed, etc.)
    const capture = await prisma.posCapture.create({
        data: {
            orgId: input.orgId,
            streamId: input.streamId,
            externalRef: input.externalRef,
            amountCents: input.amountCents,
            currency: input.currency,
            occurredAt: input.occurredAt,
            reason,
        },
    });
    // 2) Apply the designated-account transfer (into the one-way tax buffer)
    const transferResult = await applyTransfer({
        orgId: input.orgId,
        captureId: capture.id,
        amountCents: input.amountCents,
        currency: input.currency,
    });
    // 3) Generate reconciliation artifact for regulator/evidence
    const reconciliation = await generateReconciliation({
        orgId: input.orgId,
        captureId: capture.id,
        transferJournalId: transferResult.journalId,
    });
    // 4) Audit log (if an audit logger is provided)
    if (auditLogger) {
        await auditLogger({
            orgId: input.orgId,
            actorId: "system:connectors",
            action: "POS_CAPTURE_APPLIED",
            details: {
                captureId: capture.id,
                transferResult,
                reconciliation,
            },
        });
    }
    return {
        ok: true,
        reconciliation,
        transferResult,
    };
}
/**
 * Convenience wrapper for common POS capture flows.
 * You can add more specialised helpers later (bankCapture, eftposCapture, etc.).
 */
export async function capturePos(context, input, dependencies) {
    const deps = dependencies ?? DEFAULT_DEPS;
    return runCapture(context, input, "GST_CAPTURE", deps);
}
//# sourceMappingURL=index.js.map