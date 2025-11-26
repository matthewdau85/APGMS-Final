// shared/src/ledger/designated-account.ts
import type { PrismaClient } from "@prisma/client";
import type { DesignatedAccountType } from "./types.js";
import { conflict } from "../errors.js";

// Minimal shape we actually need from the Prisma model.
// This avoids having to import `Prisma` and fight with its types.
export interface DesignatedAccount {
  id: string;
  orgId: string;
  type: string;
  balance: unknown; // Prisma Decimal or number
  updatedAt: Date;
  locked: boolean;
}

// Use a const tuple so TS doesn’t complain about assignability.
const ALLOWED_TYPES = ["PAYGW_BUFFER", "GST_BUFFER"] as const;

function assertTaxType(type: string): asserts type is DesignatedAccountType {
  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unsupported designated account type: ${type}`);
  }
}

export interface BankingAdapter {
  getBalance(account: DesignatedAccount): Promise<number>;
  blockTransfer?(account: DesignatedAccount, shortfall: number): Promise<void>;
}

class PrismaBankingAdapter implements BankingAdapter {
  async getBalance(account: DesignatedAccount): Promise<number> {
    return Number((account as any).balance);
  }

  async blockTransfer(
    _account: DesignatedAccount,
    _shortfall: number,
  ): Promise<void> {
    // no-op for now; placeholder for future alerts/sandbox plan
  }
}

class PartnerBankingAdapter implements BankingAdapter {
  constructor(private url: string, private token?: string) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private accountEndpoint(account: DesignatedAccount): string {
    return `${this.url.replace(/\/$/, "")}/accounts/${account.id}`;
  }

  async getBalance(account: DesignatedAccount): Promise<number> {
    const res = await fetch(`${this.accountEndpoint(account)}/balance`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`Partner adapter balance fetch failed: ${res.status}`);
    }

    const payload = await res.json();
    return Number((payload as any).balance ?? 0);
  }

  async blockTransfer(account: DesignatedAccount, shortfall: number): Promise<void> {
    await fetch(`${this.accountEndpoint(account)}/lock`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ shortfall }),
    });
  }
}

let currentAdapter: BankingAdapter;

const partnerUrl = process.env.DESIGNATED_BANKING_URL?.trim();
const partnerToken = process.env.DESIGNATED_BANKING_TOKEN?.trim();

if (partnerUrl && partnerUrl.length > 0) {
  currentAdapter = new PartnerBankingAdapter(partnerUrl, partnerToken);
} else {
  currentAdapter = new PrismaBankingAdapter();
}

/** Configure the adapter that simulates the banking partner. Swap this for a sandbox/ADI connector later. */
export function configureBankingAdapter(adapter: BankingAdapter): void {
  currentAdapter = adapter;
}

export async function getDesignatedAccountByType(
  prisma: PrismaClient,
  orgId: string,
  type: string,
): Promise<DesignatedAccount> {
  assertTaxType(type);

  const account = (await prisma.designatedAccount.findFirst({
    where: { orgId, type },
  })) as unknown as DesignatedAccount | null;

  if (!account) {
    throw conflict(
      "designated_account_not_found",
      `Designated account for ${type} is not configured for org ${orgId}`,
    );
  }

  return account;
}

export interface CoverageContext {
  cycleId?: string;
  description?: string;
}

export async function ensureDesignatedAccountCoverage(
  prisma: PrismaClient,
  orgId: string,
  type: DesignatedAccountType,
  requiredAmount: number,
  context?: CoverageContext,
): Promise<DesignatedAccount> {
  const account = await getDesignatedAccountByType(prisma, orgId, type);
  const balance = await currentAdapter.getBalance(account);
  const shortfall = requiredAmount - balance;

  if (shortfall > 0) {
    const baseMessage = `Designated ${type} account is short by ${shortfall.toFixed(
      2,
    )} (required: ${requiredAmount.toFixed(2)}, actual: ${balance.toFixed(2)})`;

    const decoratedMessage =
      baseMessage +
      (context?.cycleId ? ` [cycle=${context.cycleId}]` : "") +
      (context?.description ? ` - ${context.description}` : "");

    await prisma.alert.create({
      data: {
        orgId,
        type: "DESIGNATED_FUNDS_SHORTFALL",
        severity: "HIGH",
        message: decoratedMessage,
      },
    });

    await currentAdapter.blockTransfer?.(account, shortfall);
    await markAccountLocked(prisma, account.id);

    throw conflict(
      "designated_insufficient_funds",
      `Designated ${type} account balance ${balance.toFixed(
        2,
      )} does not cover requirement ${requiredAmount.toFixed(2)}`,
    );
  }

  return account;
}

export async function releaseAccountLock(
  prisma: PrismaClient,
  accountId: string,
): Promise<void> {
  await prisma.designatedAccount.update({
    where: { id: accountId },
    data: {
      locked: false,
      lockedAt: null,
    },
  });
}

export async function markAccountLocked(
  prisma: PrismaClient,
  accountId: string,
): Promise<void> {
  await prisma.designatedAccount.update({
    where: { id: accountId },
    data: {
      locked: true,
      lockedAt: new Date(),
    },
  });
}

export async function reconcileAccountSnapshot(
  prisma: PrismaClient,
  orgId: string,
  type: DesignatedAccountType,
): Promise<{
  account: DesignatedAccount;
  balance: number;
  updatedAt: Date;
  locked: boolean;
}> {
  const account = await getDesignatedAccountByType(prisma, orgId, type);

  return {
    account,
    balance: await currentAdapter.getBalance(account),
    updatedAt: account.updatedAt,
    locked: account.locked,
  };
}
