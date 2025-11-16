type NumericLike = number | { valueOf: () => number } | { toNumber: () => number };

type DesignatedAccount = {
  id: string;
  balance: NumericLike;
};

function toNumber(value: NumericLike): number {
  if (typeof value === "number") {
    return value;
  }
  if ("toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value.valueOf());
}

export type CertificationStatus = "not-started" | "in-progress" | "certified";

export type ReliabilityMetrics = {
  uptimePercentage: number;
  sampleWindowDays: number;
  failedTransferRatio: number;
  totalTransfersSampled: number;
  lastIncidentAt?: string;
};

export type BankingAdapterMetadata = {
  institution: string;
  sandboxBaseUrl?: string;
  certificationStatus: CertificationStatus;
  reliability?: ReliabilityMetrics;
};

export interface BankingAdapter {
  readonly metadata: BankingAdapterMetadata;
  getBalance(account: DesignatedAccount): Promise<number>;
  blockTransfer?(account: DesignatedAccount, shortfall: number): Promise<void>;
}

export class PrismaBankingAdapter implements BankingAdapter {
  readonly metadata: BankingAdapterMetadata;

  constructor(metadata?: Partial<BankingAdapterMetadata>) {
    this.metadata = {
      institution: metadata?.institution ?? "prisma-ledger",
      sandboxBaseUrl: undefined,
      certificationStatus: metadata?.certificationStatus ?? "not-started",
      reliability:
        metadata?.reliability ?? {
          uptimePercentage: 100,
          sampleWindowDays: 30,
          failedTransferRatio: 0,
          totalTransfersSampled: 0,
        },
    } satisfies BankingAdapterMetadata;
  }

  async getBalance(account: DesignatedAccount): Promise<number> {
    return toNumber(account.balance);
  }

  async blockTransfer(account: DesignatedAccount, shortfall: number): Promise<void> {
    await account;
    await shortfall;
  }
}

type SandboxAdapterOptions = {
  baseUrl: string;
  token?: string;
  institution?: string;
  certificationStatus?: CertificationStatus;
  reliability?: ReliabilityMetrics;
};

export class SandboxBankingAdapter implements BankingAdapter {
  readonly metadata: BankingAdapterMetadata;
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: SandboxAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.metadata = {
      institution: options.institution ?? "sandbox-partner",
      sandboxBaseUrl: this.baseUrl,
      certificationStatus: options.certificationStatus ?? "in-progress",
      reliability: options.reliability,
    } satisfies BankingAdapterMetadata;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private accountEndpoint(account: DesignatedAccount, suffix: string): string {
    const trimmed = suffix.startsWith("/") ? suffix.slice(1) : suffix;
    return `${this.baseUrl}/accounts/${account.id}/${trimmed}`;
  }

  async getBalance(account: DesignatedAccount): Promise<number> {
    if (typeof fetch !== "function") {
      throw new Error("Sandbox adapter requires fetch to be available");
    }

    const res = await fetch(this.accountEndpoint(account, "balance"), {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(
        `Sandbox adapter balance fetch failed with status ${res.status}`,
      );
    }
    const payload = await res.json();
    return Number((payload as { balance?: number }).balance ?? 0);
  }

  async blockTransfer(account: DesignatedAccount, shortfall: number): Promise<void> {
    if (typeof fetch !== "function") {
      return;
    }

    await fetch(this.accountEndpoint(account, "lock"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ shortfall }),
    });
  }
}

function instantiateFromEnv(env: NodeJS.ProcessEnv = process.env): BankingAdapter {
  const partnerUrl = env.DESIGNATED_BANKING_URL?.trim();
  if (partnerUrl && partnerUrl.length > 0) {
    return new SandboxBankingAdapter({
      baseUrl: partnerUrl,
      token: env.DESIGNATED_BANKING_TOKEN?.trim(),
      institution: env.DESIGNATED_BANKING_PARTNER?.trim() ?? "sandbox-partner",
      certificationStatus: (env.DESIGNATED_BANKING_CERT_STATUS?.trim() as
        | CertificationStatus
        | undefined) ?? "in-progress",
      reliability: env.DESIGNATED_BANKING_UPTIME
        ? {
            uptimePercentage: Number(env.DESIGNATED_BANKING_UPTIME),
            sampleWindowDays: Number(env.DESIGNATED_BANKING_UPTIME_WINDOW ?? 30),
            failedTransferRatio: Number(
              env.DESIGNATED_BANKING_FAILURE_RATIO ?? 0,
            ),
            totalTransfersSampled: Number(
              env.DESIGNATED_BANKING_SAMPLE_SIZE ?? 0,
            ),
            lastIncidentAt: env.DESIGNATED_BANKING_LAST_INCIDENT?.trim(),
          }
        : undefined,
    });
  }
  return new PrismaBankingAdapter();
}

let currentAdapter: BankingAdapter = instantiateFromEnv();

export function getBankingAdapter(): BankingAdapter {
  return currentAdapter;
}

export function configureBankingAdapter(adapter: BankingAdapter): void {
  currentAdapter = adapter;
}

export function resetBankingAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BankingAdapter {
  currentAdapter = instantiateFromEnv(env);
  return currentAdapter;
}
