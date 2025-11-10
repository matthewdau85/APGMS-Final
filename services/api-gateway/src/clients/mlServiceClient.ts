import { config } from "../config.js";

type FetchImpl = typeof fetch;

export interface RiskFactor {
  factor: string;
  weight: number;
  contribution: number;
  detail: string;
}

export interface RiskAssessment {
  orgId: string;
  score: number;
  riskLevel: "low" | "medium" | "high";
  recommendedAction: string;
  explanations: string[];
  factors: RiskFactor[];
}

export interface ShortfallRiskInput {
  orgId: string;
  cashOnHand: number;
  upcomingObligations: number;
  openHighAlerts: number;
  lodgmentCompletionRatio: number;
  volatilityIndex: number;
}

export interface FraudRiskInput {
  orgId: string;
  amount: number;
  rollingAverageAmount: number;
  sameDayCount: number;
  payeeConcentration: number;
  recentVelocity: number;
}

export interface MlServiceClient {
  evaluateShortfallRisk(payload: ShortfallRiskInput): Promise<RiskAssessment>;
  evaluateFraudRisk(payload: FraudRiskInput): Promise<RiskAssessment>;
}

function normaliseBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function request<T>(
  fetchImpl: FetchImpl,
  baseUrl: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ml_service_error:${response.status}:${text}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("ml_service_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createMlServiceClient(
  baseUrl: string = config.mlServiceUrl,
  fetchImpl: FetchImpl = fetch,
): MlServiceClient {
  const url = normaliseBaseUrl(baseUrl);

  return {
    evaluateShortfallRisk(payload) {
      return request<RiskAssessment>(fetchImpl, url, "/risk/shortfall", payload);
    },
    evaluateFraudRisk(payload) {
      return request<RiskAssessment>(fetchImpl, url, "/risk/fraud", payload);
    },
  };
}

export const mlServiceClient = createMlServiceClient();
