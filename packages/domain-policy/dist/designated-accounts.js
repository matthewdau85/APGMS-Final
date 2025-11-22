/**
 * Apply a transfer into a designated account (PAYGW / GST buffer / BAS escrow).
 *
 * This implementation is deliberately defensive:
 *  - It uses `any` around Prisma models so schema tweaks don't break compilation.
 *  - It works even if `designatedAccount` / `designatedTransfer` models
 *    are missing – in that case it just returns a synthetic transferId and
 *    does not touch the database.
 *
 * It’s enough to let the rest of the stack (shared ledger, api-gateway)
 * compile and run while you iterate on the actual policy logic.
 */
export async function applyDesignatedAccountTransfer(context, input) {
    const { prisma, auditLogger } = context;
    const { orgId, accountId, amount, source, actorId } = input;
    const db = prisma;
    // 1. Load current account (if the model exists)
    let currentBalance = 0;
    let account = null;
    if (db?.designatedAccount?.findUnique) {
        account = await db.designatedAccount.findUnique({
            where: { id: accountId },
        });
        if (account && account.balance != null) {
            currentBalance = Number(account.balance);
        }
    }
    const newBalance = currentBalance + amount;
    // 2. Persist updated balance if possible
    if (db?.designatedAccount?.update) {
        account = await db.designatedAccount.update({
            where: { id: accountId },
            data: { balance: newBalance },
        });
    }
    // 3. Create a transfer record if the model exists
    let transferId = `shim-${Date.now().toString(36)}`;
    if (db?.designatedTransfer?.create) {
        const transfer = await db.designatedTransfer.create({
            data: {
                orgId,
                accountId,
                amount,
                source,
                actorId: actorId ?? "system",
            },
        });
        if (transfer?.id != null) {
            transferId = String(transfer.id);
        }
    }
    // 4. Emit audit log if a logger is wired in
    await auditLogger?.log({
        type: "DESIGNATED_ACCOUNT_TRANSFER",
        orgId,
        accountId,
        amount,
        source: source,
        actorId,
        transferId,
        newBalance,
    });
    return {
        accountId,
        newBalance,
        transferId,
        source: source,
    };
}
// Very loose ctx on purpose for now; connectors only cares that this
// function exists and returns { artifactId, sha256, summary }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateDesignatedAccountReconciliationArtifact(_ctx) {
    const artifactId = `recon-${Date.now().toString(36)}`;
    const summary = {
        orgId: "",
        accountId: "",
        asOfDate: new Date().toISOString(),
        status: "NOT_IMPLEMENTED",
    };
    // Stub hash – you can replace with real sha256 later.
    const sha256 = `stub-${artifactId}`;
    return { artifactId, sha256, summary };
}
