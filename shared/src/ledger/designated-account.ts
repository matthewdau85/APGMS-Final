import type { PrismaClient, DesignatedAccount } from "@prisma/client";
import { conflict } from "../errors.js";
import { applyDesignatedAccountTransfer } from "@apgms/domain-policy";

export type DesignatedAccountType = "PAYGW_BUFFER" | "GST_BUFFER";

const ALLOWED_TYPES: DesignatedAccountType[] = ["PAYGW_BUFFER", "GST_BUFFER"];

function assertTaxType(type: string): asserts type is DesignatedAccountType {
  if (!ALLOWED_TYPES.includes(type as DesignatedAccountType)) {
    throw new Error(`Unsupported designated account type: ${type}`);
  }
}

export interface BankingAdapter {
  getBalance(account: DesignatedAccount): Promise<number>;
  blockTransfer?(account: DesignatedAccount, shortfall: number): Promise<void>;
}

class PrismaBankingAdapter implements BankingAdapter {
  async getBalance(account: DesignatedAccount): Promise<number> {
    return Number(account.balance);
  }

  async blockTransfer(account: DesignatedAccount, shortfall: number): Promise<void> {
    await account; // no-op for now; placeholder for future alerts/sandbox plan
  }
}

let currentAdapter: BankingAdapter = new PrismaBankingAdapter();

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
  const account = await prisma.designatedAccount.findFirst({
    where: { orgId, type },
  });
  if (!account) {
    throw conflict(
      "designated_account_not_found",
      `Designated account for ${type} is not configured for org ${orgId}`,
    );
  }
  return account;
}

export async function ensureDesignatedAccountCoverage(
  prisma: PrismaClient,
  orgId: string,
  type: DesignatedAccountType,
  requiredAmount: number,
): Promise<DesignatedAccount> {
  const account = await getDesignatedAccountByType(prisma, orgId, type);
  const balance = await currentAdapter.getBalance(account);
  const shortfall = requiredAmount - balance;
  if (shortfall > 0) {
    await prisma.alert.create({
      data: {
        orgId,
        type: "DESIGNATED_FUNDS_SHORTFALL",
        severity: "HIGH",
        message: `Designated ${type} account is short by ${shortfall.toFixed(2)}`,
      },
    });
    await currentAdapter.blockTransfer?.(account, shortfall);
    throw conflict(
      "designated_insufficient_funds",
      `Designated ${type} account balance ${balance.toFixed(2)} does not cover requirement ${requiredAmount.toFixed(2)}`,
    );
  }
  return account;
}

export async function reconcileAccountSnapshot(
  prisma: PrismaClient,
  orgId: string,
  type: DesignatedAccountType,
): Promise<{
  account: DesignatedAccount;
  balance: number;
  updatedAt: Date;
}> {
  const account = await getDesignatedAccountByType(prisma, orgId, type);
  return {
    account,
    balance: Number(account.balance),
    updatedAt: account.updatedAt,
  };
}
