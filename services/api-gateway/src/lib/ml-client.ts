import { config } from "../config.js";

export type Scenario = "shortfall" | "fraud" | "plan";

export type ScorePayload = {
  features: Record<string, number>;
  context?: Record<string, unknown>;
};

export type ScoreResponse = {
  scenario: Scenario;
  issuedAt: string;
  score: number;
  passed: boolean;
  model: {
    id: string;
    version: string;
    threshold: number;
  };
  contributions: Array<{
    feature: string;
    value: number;
    weight: number;
    impact: number;
    explanation?: string;
  }>;
  drift: Record<string, number>;
};

export type PolicyEvaluation = ScoreResponse & {
  policyThreshold: number;
  policyPassed: boolean;
};

const endpointMap: Record<Scenario, string> = {
  shortfall: "/risk/shortfall",
  fraud: "/risk/fraud",
  plan: "/plan/compliance",
};

const thresholds = config.mlService.thresholds;

const DEFAULT_TIMEOUT_MS = Number.parseInt(
  process.env.ML_CLIENT_TIMEOUT_MS ?? "2500",
  10,
);

async function callModel(
  scenario: Scenario,
  payload: ScorePayload,
): Promise<ScoreResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${config.mlService.url}${endpointMap[scenario]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `ml_service_error:${response.status}:${errorBody.slice(0, 200)}`,
      );
    }

    return (await response.json()) as ScoreResponse;
  } finally {
    clearTimeout(timer);
  }
}

function getPolicyThreshold(scenario: Scenario): number {
  switch (scenario) {
    case "shortfall":
      return thresholds.shortfall;
    case "fraud":
      return thresholds.fraud;
    case "plan":
      return thresholds.plan;
    default:
      return 0.5;
  }
}

export async function scoreScenario(
  scenario: Scenario,
  payload: ScorePayload,
): Promise<PolicyEvaluation> {
  const result = await callModel(scenario, payload);
  const policyThreshold = getPolicyThreshold(scenario);
  const policyPassed = result.score < policyThreshold;
  return { ...result, policyThreshold, policyPassed };
}
