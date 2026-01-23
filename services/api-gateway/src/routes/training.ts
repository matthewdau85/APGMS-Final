// services/api-gateway/src/routes/training.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { readState } from "../state/dev-state.js";

type TrainingCatalog = {
  programId: string;
  programName: string;
  version: string;
  modules: Array<{
    moduleId: string;
    title: string;
    summary: string;
    requirements: Array<{
      requirementId: string;
      title: string;
      description: string;
      evidence: Array<{
        evidenceId: string;
        title: string;
        description: string;
        artifactTypes: string[];
      }>;
      gates: Array<{
        gateId: string;
        title: string;
        passRule: string;
      }>;
    }>;
  }>;
};

const CATALOG: TrainingCatalog = {
  programId: "clearcompliance-ato-ready",
  programName: "ClearCompliance ATO Ready Program",
  version: "2026-01-21",
  modules: [
    {
      moduleId: "m1",
      title: "Module 1: Control Fundamentals",
      summary: "Core concepts: designated accounts, ledger discipline, evidence packs.",
      requirements: [
        {
          requirementId: "m1-r1",
          title: "Designated Account Controls",
          description:
            "Learner can explain and configure one-way tax buffers and reconciliation expectations.",
          evidence: [
            {
              evidenceId: "m1-e1",
              title: "One-way account configuration screenshot",
              description:
                "Screenshot or export showing one-way account rules and configured automation.",
              artifactTypes: ["image", "pdf", "evidence-pack"],
            },
            {
              evidenceId: "m1-e2",
              title: "Short written control rationale",
              description:
                "A short statement explaining why the control exists and how it prevents misuse.",
              artifactTypes: ["markdown", "pdf"],
            },
          ],
          gates: [
            {
              gateId: "m1-g1",
              title: "Knowledge check",
              passRule: "Score >= 80% on 10-question quiz (to be implemented).",
            },
          ],
        },
      ],
    },
    {
      moduleId: "m2",
      title: "Module 2: Setup + Operational Readiness",
      summary: "Setup workflow, connector readiness, and baseline health checks.",
      requirements: [
        {
          requirementId: "m2-r1",
          title: "Successful org setup flow",
          description:
            "Learner can complete setup, create first admin, configure connectors, and verify readiness.",
          evidence: [
            {
              evidenceId: "m2-e1",
              title: "verify-setup log bundle",
              description:
                "Run logs showing /ready and setup endpoints passing (setup-debug bundle).",
              artifactTypes: ["text", "zip", "evidence-pack"],
            },
          ],
          gates: [
            {
              gateId: "m2-g1",
              title: "Operational gate",
              passRule: "/ready returns ok=true and setupComplete=true.",
            },
          ],
        },
      ],
    },
  ],
};

export default async function trainingRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/training/catalog", async (_req, reply) => {
    const s = readState();
    const enabled = Boolean(s.orgSettings.addons.clearComplianceTraining);

    if (!enabled) {
      return reply.code(404).send({ error: "not_found" });
    }

    return reply.send(CATALOG);
  });
}
