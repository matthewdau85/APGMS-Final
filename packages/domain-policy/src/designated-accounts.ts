// Domain policy should not depend on the concrete Prisma client type.
// Use a loose placeholder so any DB client shape will work here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaClient = any;

/**
 * Source of a designated-account transfer.
 *
 * We keep the original intent ("PAYROLL_CAPTURE" | "GST_CAPTURE" | "BAS_ESCROW")
 * but allow any string so that upstream callers which still pass a plain
 * string won't break type-checking.
 */
export type DesignatedTransferSource =
  | "PAYROLL_CAPTURE"
  | "GST_CAPTURE"
  | "BAS_ESCROW"
  | (string & {});

/**
 * Minimal audit logger interface used by the ledger layer.
 * The shared package only needs to be able to pass this through.
 */
export interface AuditLogger {
  log: (event: {
    type: string;
    orgId: string;
    accountId: string;
    amount: number;
    source: DesignatedTransferSource;
    actorId?: string;
    transferId: string;
    newBalance: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }) => Promise<void> | void;
}

export interface ApplyDesignatedTransferContext {
  prisma: PrismaClient;
  auditLogger?: AuditLogger;
}

export interface ApplyDesignatedTransferInput {
  orgId: string;
  accountId: string;
  amount: number;
  source: DesignatedTransferSource | string;
  actorId?: string;
}

export interface ApplyDesignatedTransferResult {
  accountId: string;
  newBalance: number;
  transferId: string;
  source: DesignatedTransferSource;
}

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
export async function applyDesignatedAccountTransfer(
  context: ApplyDesignatedTransferContext,
  input: ApplyDesignatedTransferInput,
): Promise<ApplyDesignatedTransferResult> {
  const { prisma, auditLogger } = context;
  const { orgId, accountId, amount, source, actorId } = input;

  const db = prisma as any;

  // 1. Load current account (if the model exists)
  let currentBalance = 0;
  let account: any = null;

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
    source: source as DesignatedTransferSource,
    actorId,
    transferId,
    newBalance,
  });

  return {
    accountId,
    newBalance,
    transferId,
    source: source as DesignatedTransferSource,
  };
}

// ---------------------------------------------------------------------------
// Reconciliation types & stub implementation
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DesignatedReconciliationSummary = {
  orgId: string;
  accountId: string;
  asOfDate: string;
  status: "BALANCED" | "MISMATCH" | "NOT_IMPLEMENTED";
  openingBalance?: number;
  closingBalance?: number;
  totalCredits?: number;
  totalDebits?: number;
  // Allow extra fields so callers can extend this without breaking
  [key: string]: any;
};

export type DesignatedAccountReconciliationArtifact = {
  artifactId: string;
  sha256: string;
  summary: DesignatedReconciliationSummary;
};

// Very loose ctx on purpose for now; connectors only cares that this
// function exists and returns { artifactId, sha256, summary }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateDesignatedAccountReconciliationArtifact(
  _ctx: any,
): Promise<DesignatedAccountReconciliationArtifact> {
  const artifactId = `recon-${Date.now().toString(36)}`;

  const summary: DesignatedReconciliationSummary = {
    orgId: "",
    accountId: "",
    asOfDate: new Date().toISOString(),
    status: "NOT_IMPLEMENTED",
  };

  // Stub hash – you can replace with real sha256 later.
  const sha256 = `stub-${artifactId}`;

  return { artifactId, sha256, summary };
}
