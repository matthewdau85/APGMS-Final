import { URL } from "node:url";

export type RiskLevel = "low" | "medium" | "high";

export interface ContributingFactor {
  readonly feature: string;
  readonly weight: number;
  readonly impact: number;
}

export interface RiskAssessment {
  readonly modelVersion: string;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly recommendedMitigations: readonly string[];
  readonly explanation: string;
  readonly contributingFactors: readonly ContributingFactor[];
}

export interface ShortfallPayload {
  readonly orgId: string;
  readonly liquidityCoverage: number;
  readonly escrowCoverage: number;
  readonly outstandingAlerts: number;
  readonly basWindowDays: number;
  readonly recentShortfalls: number;
}

export interface FraudPayload {
  readonly transactionId: string;
  readonly amount: number;
  readonly channelRisk: number;
  readonly velocity: number;
  readonly geoDistance: number;
  readonly accountTenureDays: number;
  readonly previousIncidents: number;
}

export interface MlRiskClient {
  evaluateShortfall(payload: ShortfallPayload): Promise<RiskAssessment>;
  evaluateFraud(payload: FraudPayload): Promise<RiskAssessment>;
}

export class MlServiceError extends Error {
  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "MlServiceError";
  }
}

interface FetchDeps {
  fetchImpl?: typeof fetch;
}

async function request<TPayload extends Record<string, unknown>, TResponse>(
  baseUrl: string,
  path: string,
  payload: TPayload,
  deps: FetchDeps,
): Promise<TResponse> {
  const url = new URL(path, baseUrl).toString();
  const fetcher = deps.fetchImpl ?? globalThis.fetch;
  if (!fetcher) {
    throw new Error("fetch is not available in the current runtime");
  }
  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new MlServiceError(response.status, body || "ml_service_error");
  }
  return (await response.json()) as TResponse;
}

export function createMlClient(baseUrl: string, deps: FetchDeps = {}): MlRiskClient {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return {
    evaluateShortfall(payload) {
      return request<ShortfallPayload, RiskAssessment>(
        normalizedBase,
        "risk/shortfall",
        payload,
        deps,
      );
    },
    evaluateFraud(payload) {
      return request<FraudPayload, RiskAssessment>(
        normalizedBase,
        "risk/fraud",
        payload,
        deps,
      );
    },
  };
}
