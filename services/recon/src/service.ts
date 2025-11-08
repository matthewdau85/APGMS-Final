import { SpanStatusCode, trace } from "@opentelemetry/api";
import { PrismaClient } from "@prisma/client";

import { config } from "./config.js";
import { deriveFeatureVector } from "./features.js";
import { runModelInference } from "./inference.js";
import { loadLatestModel } from "./model.js";
import {
  conceptDriftGauge,
  conceptDriftTotal,
  fallbackCounter,
  inferenceErrors,
  inferenceLatency,
  inferenceRequests,
} from "./metrics.js";
import type { InferenceResult } from "./types.js";

type Transport = "http" | "grpc";

const tracer = trace.getTracer("services.recon.core");

const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
});

export class ReconciliationService {
  private readonly prisma = prisma;

  async runInference(orgId: string, artifactId?: string, transport: Transport = "http"): Promise<InferenceResult> {
    inferenceRequests.labels(transport).inc();

    let decisionLabel: string | undefined;
    const endTimer = inferenceLatency.startTimer({ transport });
    const span = tracer.startSpan("recon.runInference", {
      attributes: {
        "recon.orgId": orgId,
        "recon.transport": transport,
        "recon.request.artifactId": artifactId ?? "",
      },
    });

    try {
      const artifact = await this.prisma.evidenceArtifact.findFirstOrThrow({
        where: {
          orgId,
          kind: "designated-reconciliation",
          ...(artifactId ? { id: artifactId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      const summary = artifact.payload as {
        generatedAt?: string;
        totals?: { paygw: number; gst: number };
        movementsLast24h?: Array<{
          accountId: string;
          type: string;
          balance: number;
          inflow24h: number;
          transferCount24h: number;
        }>;
      };

      if (
        !summary ||
        typeof summary.generatedAt !== "string" ||
        !summary.totals ||
        !Array.isArray(summary.movementsLast24h)
      ) {
        throw new Error("Artifact payload missing reconciliation summary");
      }

      const model = await loadLatestModel();
      const features = deriveFeatureVector({
        generatedAt: summary.generatedAt,
        totals: summary.totals,
        movementsLast24h: summary.movementsLast24h,
      });

      const inference = runModelInference(model, features);
      decisionLabel = inference.decision;

      conceptDriftGauge.reset();
      if (inference.driftSignals.length > 0) {
        conceptDriftTotal.inc();
        for (const signal of inference.driftSignals) {
          conceptDriftGauge.labels(signal.feature).set(signal.score);
        }
      }
      if (inference.fallbackRecommended) {
        fallbackCounter.inc();
      }

      const result: InferenceResult = {
        artifactId: artifact.id,
        generatedAt: summary.generatedAt,
        modelVersion: model.version,
        features,
        ...inference,
      };

      span.setAttribute("recon.model.version", model.version);
      span.setAttribute("recon.inference.decision", inference.decision);
      span.setAttribute("recon.inference.confidence", inference.confidence);
      span.setAttribute("recon.inference.riskScore", inference.riskScore);
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      inferenceErrors.labels(transport, error instanceof Error ? error.name : "unknown").inc();
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);
      throw error;
    } finally {
      endTimer({ decision: decisionLabel ?? "unknown" });
      span.end();
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
