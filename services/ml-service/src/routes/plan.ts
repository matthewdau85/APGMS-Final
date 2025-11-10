import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { inferenceDuration } from "../lib/metrics.js";
import { requireModel } from "../lib/modelRegistry.js";
import { buildExplanations, scoreModel } from "../lib/scoring.js";
import { observeDrift } from "../lib/drift.js";

const complianceSchema = z.object({
  controlCoverage: z.number().min(0).max(1),
  openFindings: z.number().min(0),
  trainingCompletion: z.number().min(0).max(1),
  region: z.string().optional()
});

type CompliancePlanResponse = {
  model: {
    name: string;
    version: string;
    threshold: number;
  };
  score: number;
  maturity: "strong" | "attention";
  tasks: Array<{
    title: string;
    status: "open" | "monitor" | "complete";
    context: string;
  }>;
  explanations: ReturnType<typeof buildExplanations>;
  drift: {
    flagged: boolean;
    deltas: Array<{ feature: string; delta: number }>;
    tolerance: number;
  };
};

export async function registerPlanRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: z.infer<typeof complianceSchema> }>("/plan/compliance", async (request, reply) => {
    const parsed = complianceSchema.parse(request.body);
    const model = await requireModel("compliance_plan");
    const features = {
      controlCoverage: parsed.controlCoverage,
      openFindings: parsed.openFindings,
      trainingCompletion: parsed.trainingCompletion
    };

    const timerEnd = inferenceDuration.startTimer({ model: model.name });
    const { score, contributions } = scoreModel(model, features);
    timerEnd();

    const drift = observeDrift(model, features);
    const flagged = drift.some((entry) => Math.abs(entry.delta) > model.driftTolerance);
    const explanations = buildExplanations(model, features);

    const tasks: CompliancePlanResponse["tasks"] = [];

    for (const contribution of contributions) {
      const abs = Math.abs(contribution.contribution);
      if (contribution.feature === "controlCoverage" && contribution.value < 0.9) {
        tasks.push({
          title: "Close control coverage gaps",
          status: "open",
          context: "Gap analysis indicates missing control attestations in the last quarter."
        });
      } else if (contribution.feature === "openFindings" && contribution.value > 0.2) {
        tasks.push({
          title: "Prioritise regulator findings",
          status: "open",
          context: "Outstanding findings exceed agreed SLA. Assign owners to unblock BAS readiness."
        });
      } else if (contribution.feature === "trainingCompletion" && contribution.value < 0.8) {
        tasks.push({
          title: "Increase training completion",
          status: "monitor",
          context: "Send reminders for overdue compliance training modules."
        });
      } else if (abs > 0.2) {
        tasks.push({
          title: `Monitor ${contribution.feature}`,
          status: "monitor",
          context: "Metric materially influences the compliance score; track weekly."
        });
      }
    }

    if (tasks.length === 0) {
      tasks.push({
        title: "Maintain control evidence",
        status: "complete",
        context: "Inputs meet maturity targets. Keep evidence packs up to date."
      });
    }

    const maturity = score >= model.threshold ? "attention" : "strong";

    reply.send({
      model: { name: model.name, version: model.version, threshold: model.threshold },
      score,
      maturity,
      tasks,
      explanations,
      drift: {
        flagged,
        deltas: drift,
        tolerance: model.driftTolerance
      }
    });
  });
}
