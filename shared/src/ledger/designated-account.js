import { conflict } from "../errors.js";
// Use a const tuple so TS doesn’t complain about assignability.
const ALLOWED_TYPES = ["PAYGW_BUFFER", "GST_BUFFER"];
function assertTaxType(type) {
    if (!ALLOWED_TYPES.includes(type)) {
        throw new Error(`Unsupported designated account type: ${type}`);
    }
}
class PrismaBankingAdapter {
    async getBalance(account) {
        return Number(account.balance);
    }
    async blockTransfer(_account, _shortfall) {
        // no-op for now; placeholder for future alerts/sandbox plan
    }
}
class PartnerBankingAdapter {
    constructor(url, token) {
        this.url = url;
        this.token = token;
    }
    headers() {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }
    accountEndpoint(account) {
        return `${this.url.replace(/\/$/, "")}/accounts/${account.id}`;
    }
    async getBalance(account) {
        const res = await fetch(`${this.accountEndpoint(account)}/balance`, {
            headers: this.headers(),
        });
        if (!res.ok) {
            throw new Error(`Partner adapter balance fetch failed: ${res.status}`);
        }
        const payload = await res.json();
        return Number(payload.balance ?? 0);
    }
    async blockTransfer(account, shortfall) {
        await fetch(`${this.accountEndpoint(account)}/lock`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ shortfall }),
        });
    }
}
let currentAdapter;
const partnerUrl = process.env.DESIGNATED_BANKING_URL?.trim();
const partnerToken = process.env.DESIGNATED_BANKING_TOKEN?.trim();
if (partnerUrl && partnerUrl.length > 0) {
    currentAdapter = new PartnerBankingAdapter(partnerUrl, partnerToken);
}
else {
    currentAdapter = new PrismaBankingAdapter();
}
/** Configure the adapter that simulates the banking partner. Swap this for a sandbox/ADI connector later. */
export function configureBankingAdapter(adapter) {
    currentAdapter = adapter;
}
export async function getDesignatedAccountByType(prisma, orgId, type) {
    assertTaxType(type);
    const account = (await prisma.designatedAccount.findFirst({
        where: { orgId, type },
    }));
    if (!account) {
        throw conflict("designated_account_not_found", `Designated account for ${type} is not configured for org ${orgId}`);
    }
    return account;
}
export async function ensureDesignatedAccountCoverage(prisma, orgId, type, requiredAmount, context) {
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
                metadata: {
                    requiredAmount,
                    balance,
                    cycleId: context?.cycleId ?? null,
                    description: context?.description ?? null,
                },
            },
        });
        await currentAdapter.blockTransfer?.(account, shortfall);
        await markAccountLocked(prisma, account.id);
        throw conflict("designated_insufficient_funds", `Designated ${type} account balance ${balance.toFixed(2)} does not cover requirement ${requiredAmount.toFixed(2)}`);
    }
    return account;
}
export async function releaseAccountLock(prisma, accountId) {
    await prisma.designatedAccount.update({
        where: { id: accountId },
        data: {
            locked: false,
            lockedAt: null,
        },
    });
}
export async function markAccountLocked(prisma, accountId) {
    await prisma.designatedAccount.update({
        where: { id: accountId },
        data: {
            locked: true,
            lockedAt: new Date(),
        },
    });
}
export async function reconcileAccountSnapshot(prisma, orgId, type) {
    const account = await getDesignatedAccountByType(prisma, orgId, type);
    return {
        account,
        balance: await currentAdapter.getBalance(account),
        updatedAt: account.updatedAt,
        locked: account.locked,
    };
}
