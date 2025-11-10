export interface RiskFeatureExplanation {
  readonly name: string;
  readonly value: number;
  readonly weight: number;
  readonly impact: number;
  readonly rationale: string;
  readonly mitigation: string;
}

export interface RiskScoreResponse {
  readonly model: string;
  readonly score: number;
  readonly threshold: number;
  readonly risk_level: "low" | "medium" | "high";
  readonly exceeds_threshold: boolean;
  readonly mitigations: readonly string[];
  readonly top_explanations: readonly RiskFeatureExplanation[];
}

export interface ShortfallRiskPayload {
  readonly cash_on_hand: number;
  readonly monthly_burn: number;
  readonly obligations_due: number;
  readonly forecast_revenue: number;
}

export interface FraudRiskPayload {
  readonly transfer_amount: number;
  readonly daily_velocity: number;
  readonly anomalous_counterparties: number;
  readonly auth_risk_score: number;
  readonly device_trust_score: number;
}

export class MlServiceClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 2500,
  ) {}

  private async postJson<TPayload extends Record<string, unknown>, TResponse>(
    path: string,
    payload: TPayload,
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `ml_service_request_failed status=${response.status} body=${text.slice(0, 200)}`,
        );
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("ml_service_request_timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async readinessProbe(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(1500, this.timeoutMs));
      try {
        const response = await fetch(new URL("/health", this.baseUrl), {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) return false;
        const body = (await response.json()) as { ok?: boolean };
        return body.ok === true;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return false;
    }
  }

  public scoreShortfall(payload: ShortfallRiskPayload): Promise<RiskScoreResponse> {
    return this.postJson("/risk/shortfall", payload);
  }

  public scoreFraud(payload: FraudRiskPayload): Promise<RiskScoreResponse> {
    return this.postJson("/risk/fraud", payload);
  }
}

export function shouldBlockTransfer(result: RiskScoreResponse): boolean {
  return result.exceeds_threshold || result.score >= result.threshold;
}

export function summarizeMitigations(result: RiskScoreResponse): string[] {
  const mitigations = new Set<string>();
  for (const step of result.mitigations ?? []) {
    if (step && step.trim().length > 0) {
      mitigations.add(step.trim());
    }
  }
  if (mitigations.size === 0) {
    for (const explanation of result.top_explanations ?? []) {
      if (explanation.mitigation && explanation.mitigation.trim().length > 0) {
        mitigations.add(explanation.mitigation.trim());
      }
    }
  }
  return [...mitigations];
}
