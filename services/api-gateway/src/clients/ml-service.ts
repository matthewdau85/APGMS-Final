import type { FastifyBaseLogger } from "fastify";

export interface MlServiceClientOptions {
  readonly baseUrl: string;
  readonly thresholds: {
    readonly shortfall: number;
    readonly fraud: number;
    readonly compliance: number;
  };
  readonly logger?: FastifyBaseLogger;
}

export interface ShortfallRiskPayload {
  readonly orgId: string;
  readonly basCycleId?: string;
  readonly cashCoverageRatio: number;
  readonly varianceIndex: number;
  readonly openAlertRatio: number;
}

export interface FraudRiskPayload {
  readonly orgId: string;
  readonly velocityScore: number;
  readonly patternDeviation: number;
  readonly vendorConcentration: number;
}

export interface CompliancePlanPayload {
  readonly orgId: string;
  readonly installmentReliability: number;
  readonly liquidityBuffer: number;
  readonly planHistory: number;
}

export interface RiskFeedbackPayload {
  readonly caseType: string;
  readonly caseId: string;
  readonly orgId: string;
  readonly label: string;
  readonly override?: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly submittedBy?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RiskEvaluation {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly confidenceInterval: [number, number];
  readonly recommendedActions: ReadonlyArray<string>;
  readonly contributingFeatures: Record<string, number>;
  readonly requiresManualReview: boolean;
  readonly threshold: number;
}

interface MlServiceResponse {
  readonly evaluation: {
    readonly modelId: string;
    readonly modelVersion: string;
    readonly score: number;
    readonly confidenceInterval: [number, number];
    readonly recommendedActions: string[];
    readonly contributingFeatures: Record<string, number>;
  };
}

export class MlServiceClient {
  private readonly baseUrl: string;
  private readonly thresholds: MlServiceClientOptions["thresholds"];
  private readonly logger?: FastifyBaseLogger;

  constructor(options: MlServiceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.thresholds = options.thresholds;
    this.logger = options.logger;
  }

  async scoreShortfall(payload: ShortfallRiskPayload): Promise<RiskEvaluation> {
    const response = await this.post<MlServiceResponse>("/risk/shortfall", payload);
    return this.applyThreshold(response.evaluation, this.thresholds.shortfall);
  }

  async scoreFraud(payload: FraudRiskPayload): Promise<RiskEvaluation> {
    const response = await this.post<MlServiceResponse>("/risk/fraud", payload);
    return this.applyThreshold(response.evaluation, this.thresholds.fraud);
  }

  async scoreCompliancePlan(payload: CompliancePlanPayload): Promise<RiskEvaluation> {
    const response = await this.post<MlServiceResponse>("/plan/compliance", payload);
    return this.applyThreshold(response.evaluation, this.thresholds.compliance);
  }

  async submitFeedback(payload: RiskFeedbackPayload): Promise<void> {
    try {
      await this.post<{ feedback: Record<string, unknown> }>("/feedback", payload);
    } catch (error) {
      this.logger?.warn({ err: error }, "ml_feedback_forward_failed");
    }
  }

  private applyThreshold(
    evaluation: MlServiceResponse["evaluation"],
    threshold: number,
  ): RiskEvaluation {
    const requiresManualReview = evaluation.score >= threshold;
    return {
      modelId: evaluation.modelId,
      modelVersion: evaluation.modelVersion,
      score: evaluation.score,
      confidenceInterval: evaluation.confidenceInterval,
      recommendedActions: evaluation.recommendedActions,
      contributingFeatures: evaluation.contributingFeatures,
      requiresManualReview,
      threshold,
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`ml_service_error:${response.status}`);
        (error as Error & { detail?: string }).detail = text;
        throw error;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger?.error({ err: error, path }, "ml_service_request_failed");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
