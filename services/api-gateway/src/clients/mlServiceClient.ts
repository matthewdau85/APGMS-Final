import { URL } from "node:url";
import { z } from "zod";
import { config } from "../config.js";

const riskResponseSchema = z.object({
  model: z.object({
    name: z.string(),
    version: z.string(),
    threshold: z.number()
  }),
  score: z.number(),
  recommendation: z.enum(["allow", "review"]),
  contributions: z.array(
    z.object({
      feature: z.string(),
      value: z.number(),
      weight: z.number(),
      contribution: z.number()
    })
  ),
  explanations: z.array(
    z.object({
      feature: z.string(),
      direction: z.enum(["increase", "decrease"]),
      summary: z.string()
    })
  ),
  drift: z.object({
    flagged: z.boolean(),
    tolerance: z.number(),
    deltas: z.array(z.object({ feature: z.string(), delta: z.number() }))
  })
});

const planResponseSchema = z.object({
  model: z.object({
    name: z.string(),
    version: z.string(),
    threshold: z.number()
  }),
  score: z.number(),
  maturity: z.enum(["strong", "attention"]),
  tasks: z.array(
    z.object({
      title: z.string(),
      status: z.enum(["open", "monitor", "complete"]),
      context: z.string()
    })
  ),
  explanations: z.array(
    z.object({
      feature: z.string(),
      direction: z.enum(["increase", "decrease"]),
      summary: z.string()
    })
  ),
  drift: z.object({
    flagged: z.boolean(),
    tolerance: z.number(),
    deltas: z.array(z.object({ feature: z.string(), delta: z.number() }))
  })
});

export type RiskEvaluation = z.infer<typeof riskResponseSchema>;
export type CompliancePlan = z.infer<typeof planResponseSchema>;

export interface ShortfallFeatures {
  liquidityRatio: number;
  burnRate: number;
  variance: number;
}

export interface FraudFeatures {
  amount: number;
  velocity: number;
  geoRisk: number;
}

export interface ComplianceFeatures {
  controlCoverage: number;
  openFindings: number;
  trainingCompletion: number;
}

export interface MlServiceClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class MlServiceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MlServiceClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? config.mlService.baseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async post<T>(path: string, body: unknown, schema: z.ZodSchema<T>): Promise<T> {
    const target = new URL(path, this.baseUrl);
    const res = await this.fetchImpl(target, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ml-service ${path} failed with ${res.status}: ${text}`);
    }

    const payload = await res.json();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Unexpected ml-service payload for ${path}: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async evaluateShortfall(features: ShortfallFeatures): Promise<{
    evaluation: RiskEvaluation;
    threshold: number;
    allow: boolean;
  }> {
    const evaluation = await this.post("/risk/shortfall", features, riskResponseSchema);
    const threshold = config.mlService.shortfallThreshold;
    const allow = evaluation.score < threshold;
    return { evaluation, threshold, allow };
  }

  async evaluateFraud(features: FraudFeatures): Promise<{
    evaluation: RiskEvaluation;
    threshold: number;
    allow: boolean;
  }> {
    const evaluation = await this.post("/risk/fraud", features, riskResponseSchema);
    const threshold = config.mlService.fraudThreshold;
    const allow = evaluation.score < threshold;
    return { evaluation, threshold, allow };
  }

  async buildCompliancePlan(features: ComplianceFeatures): Promise<{
    plan: CompliancePlan;
    threshold: number;
    attention: boolean;
  }> {
    const plan = await this.post("/plan/compliance", features, planResponseSchema);
    const threshold = config.mlService.complianceThreshold;
    const attention = plan.score >= threshold;
    return { plan, threshold, attention };
  }
}
