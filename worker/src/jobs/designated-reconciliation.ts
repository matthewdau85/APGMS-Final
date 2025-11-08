import { prisma } from "@apgms/shared/db.js";

import {
  generateDesignatedAccountReconciliationArtifact,
} from "../../../domain/policy/designated-accounts.js";

const SYSTEM_ACTOR = "system";
const DEFAULT_RECON_ENDPOINT = "http://localhost:7100/v1/inference";
const DEFAULT_CONFIDENCE_FLOOR = 0.65;

type InferenceResponse = {
  artifactId: string;
  generatedAt: string;
  modelVersion: string;
  riskScore: number;
  confidence: number;
  decision: "CLEAR" | "REVIEW";
  fallbackRecommended: boolean;
  driftSignals: Array<{ feature: string; score: number; threshold: number }>;
  features: Record<string, number>;
};

type DeterministicOutcome = {
  decision: "CLEAR" | "REVIEW";
  reasons: string[];
};

async function recordAuditLog(entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      metadata: entry.metadata,
    },
  });
}

function getReconEndpoint(): string {
  return process.env.RECON_HTTP_ENDPOINT ?? DEFAULT_RECON_ENDPOINT;
}

function getConfidenceFloor(): number {
  const raw = process.env.RECON_CONFIDENCE_FLOOR ?? String(DEFAULT_CONFIDENCE_FLOOR);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_CONFIDENCE_FLOOR;
}

async function invokeReconInference(orgId: string, artifactId: string): Promise<InferenceResponse | null> {
  const endpoint = getReconEndpoint();
  const httpFetch = globalThis.fetch;
  if (typeof httpFetch !== "function") {
    throw new Error("Global fetch API is not available in this runtime");
  }

  const response = await httpFetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ orgId, artifactId }),
  });

  if (!response.ok) {
    throw new Error(`Recon service returned ${response.status}`);
  }

  return (await response.json()) as InferenceResponse;
}

function evaluateDeterministicFallback(
  summary: {
    totals: { paygw: number; gst: number };
    movementsLast24h: Array<{
      type: string;
      balance: number;
      inflow24h: number;
      transferCount24h: number;
    }>;
  },
): DeterministicOutcome {
  const reasons: string[] = [];
  if (summary.totals.paygw < 0) {
    reasons.push("PAYGW balance negative");
  }
  if (summary.totals.gst < 0) {
    reasons.push("GST balance negative");
  }

  const zeroInflowAccounts = summary.movementsLast24h.filter((movement) => movement.inflow24h === 0);
  if (zeroInflowAccounts.length > 2) {
    reasons.push("Multiple designated accounts recorded zero inflow in past 24h");
  }

  const oversizedTransfers = summary.movementsLast24h.filter((movement) => movement.inflow24h > 50000);
  if (oversizedTransfers.length > 0) {
    reasons.push("Detected unusually large inflows into designated account");
  }

  const totalTransfers = summary.movementsLast24h.reduce((acc, movement) => acc + movement.transferCount24h, 0);
  if (totalTransfers === 0) {
    reasons.push("No inflow events captured in past 24h");
  }

  return {
    decision: reasons.length > 0 ? "REVIEW" : "CLEAR",
    reasons,
  };
}

export async function runNightlyDesignatedAccountReconciliation(): Promise<void> {
  const organisations = await prisma.org.findMany({
    select: { id: true },
  });

  const confidenceFloor = getConfidenceFloor();

  for (const org of organisations) {
    const reconciliation = await generateDesignatedAccountReconciliationArtifact(
      {
        prisma,
        auditLogger: recordAuditLog,
      },
      org.id,
      SYSTEM_ACTOR,
    );

    let inference: InferenceResponse | null = null;
    let inferenceError: Error | null = null;
    try {
      inference = await invokeReconInference(org.id, reconciliation.artifactId);
    } catch (error) {
      inferenceError = error instanceof Error ? error : new Error(String(error));
      await recordAuditLog({
        orgId: org.id,
        actorId: SYSTEM_ACTOR,
        action: "designatedAccount.reconciliationInference.error",
        metadata: {
          artifactId: reconciliation.artifactId,
          message: inferenceError.message,
        },
      });
    }

    const fallback = evaluateDeterministicFallback(reconciliation.summary);
    let finalDecision = fallback.decision;
    let usingFallback = true;
    let appliedReasons = [...fallback.reasons];

    if (inference && inferenceError === null) {
      const confident = inference.confidence >= confidenceFloor && !inference.fallbackRecommended;
      if (confident) {
        finalDecision = inference.decision;
        usingFallback = false;
        appliedReasons = inference.driftSignals.length
          ? inference.driftSignals.map((signal) => `drift:${signal.feature}:${signal.score.toFixed(2)}`)
          : [];
      }
    }

    await prisma.monitoringSnapshot.create({
      data: {
        orgId: org.id,
        type: "designated-reconciliation",
        payload: {
          generatedAt: reconciliation.summary.generatedAt,
          artifactId: reconciliation.artifactId,
          sha256: reconciliation.sha256,
          inference,
          inferenceError: inferenceError?.message ?? null,
          fallback: {
            decision: fallback.decision,
            reasons: fallback.reasons,
          },
          finalDecision,
          usingFallback,
          appliedReasons,
        },
      },
    });

    await recordAuditLog({
      orgId: org.id,
      actorId: SYSTEM_ACTOR,
      action: "designatedAccount.reconciliationInference",
      metadata: {
        artifactId: reconciliation.artifactId,
        sha256: reconciliation.sha256,
        finalDecision,
        usingFallback,
        confidence: inference?.confidence ?? null,
        riskScore: inference?.riskScore ?? null,
        modelVersion: inference?.modelVersion ?? null,
        driftSignals: inference?.driftSignals ?? [],
      },
    });
  }
}
