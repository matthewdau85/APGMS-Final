import type { FastifyInstance } from "fastify";

import { authGuard } from "../../auth.js";
import { prisma } from "../../db.js";
import { recordAuditLog } from "../../lib/audit.js";
import {
  fetchLatestBasDiscrepancyReport,
  type BasDiscrepancyArtifact,
} from "../../../../domain/bas/verifier.js";

export type DiscrepancyReportResponse = ReturnType<typeof shapeDiscrepancyReport> | null;

export default async function registerBasComplianceRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/compliance/bas/discrepancy-report",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const report = await fetchLatestBasDiscrepancyReport(prisma, orgId);

      if (!report) {
        reply.send({ report: null });
        return;
      }

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "compliance.bas.discrepancy.fetch",
        metadata: { artifactId: report.id },
      });

      reply.send({ report: shapeDiscrepancyReport(report) });
    },
  );
}

export function shapeDiscrepancyReport(
  artifact: BasDiscrepancyArtifact & { payload: any },
) {
  const payload = artifact.payload ?? {};
  return {
    id: artifact.id,
    sha256: artifact.sha256,
    generatedAt: artifact.generatedAt,
    basCycle: payload.basCycle ?? null,
    expected: payload.expected ?? null,
    designated: payload.designated ?? null,
    discrepancies: payload.discrepancies ?? [],
    remediation: payload.remediation ?? [],
    jsonHash: payload.jsonHash ?? null,
    pdfBase64: payload.pdfBase64 ?? null,
    json: payload,
  };
}
