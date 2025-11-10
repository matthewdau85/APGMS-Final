export type PaygwBracket = {
  threshold: number | null;
  rate: number;
  base: number;
};

export type PaygwCalculationInput = {
  taxableIncome: number;
  brackets: ReadonlyArray<PaygwBracket>;
};

export type PaygwCalculationResult = {
  withheld: number;
  effectiveRate: number;
};

export type GstCalculationInput = {
  amount: number;
  rate?: number;
};

export type GstCalculationResult = {
  gstPortion: number;
  netOfGst: number;
};

export interface TaxEngineClient {
  calculatePaygw(input: PaygwCalculationInput): Promise<PaygwCalculationResult>;
  calculateGst(input: GstCalculationInput): Promise<GstCalculationResult>;
}

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type HttpTaxEngineClientOptions = {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

export class HttpTaxEngineClient implements TaxEngineClient {
  #baseUrl: string;
  #fetchImpl: FetchLike;
  #timeoutMs: number;

  constructor(options: HttpTaxEngineClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    if (!options.fetchImpl && typeof (globalThis as any).fetch !== "function") {
      throw new Error("global fetch is not available; provide fetchImpl");
    }
    this.#fetchImpl = (options.fetchImpl ?? ((globalThis as any).fetch.bind(globalThis) as FetchLike));
    this.#timeoutMs = options.timeoutMs ?? 5_000;
  }

  async calculatePaygw(input: PaygwCalculationInput): Promise<PaygwCalculationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetchImpl(`${this.#baseUrl}/v1/paygw`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taxable_income: input.taxableIncome,
          brackets: input.brackets.map((bracket) => ({
            threshold: bracket.threshold,
            rate: bracket.rate,
            base: bracket.base,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`tax engine paygw request failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        withheld: number;
        effective_rate: number;
      };

      return {
        withheld: payload.withheld,
        effectiveRate: payload.effective_rate,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async calculateGst(input: GstCalculationInput): Promise<GstCalculationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetchImpl(`${this.#baseUrl}/v1/gst`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: input.amount, rate: input.rate }),
      });

      if (!response.ok) {
        throw new Error(`tax engine gst request failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        gst_portion: number;
        net_of_gst: number;
      };

      return {
        gstPortion: payload.gst_portion,
        netOfGst: payload.net_of_gst,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
