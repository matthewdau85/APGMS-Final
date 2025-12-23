// services/api-gateway/src/routes/schemas.ts

/**
 * Fastify JSON Schemas (Ajv) for regulator endpoints.
 * Keep these minimal + compatible with tests.
 */

export const RegulatorComplianceSummaryQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["orgId", "period"],
  properties: {
    orgId: { type: "string" },
    period: { type: "string" },
  },
} as const;

export const RegulatorComplianceSummaryReplySchema = {
  type: "object",
  additionalProperties: true,
  required: ["orgId", "period", "basCoverageRatio", "risk"],
  properties: {
    orgId: { type: "string" },
    period: { type: "string" },

    paygwDueCents: { type: "integer" },
    gstDueCents: { type: "integer" },
    totalDueCents: { type: "integer" },

    paygwHeldCents: { type: "integer" },
    gstHeldCents: { type: "integer" },
    totalHeldCents: { type: "integer" },

    paygwShortfallCents: { type: "integer" },
    gstShortfallCents: { type: "integer" },
    totalShortfallCents: { type: "integer" },

    basCoverageRatio: { type: "number" },

    risk: {
      type: "object",
      additionalProperties: false,
      required: ["riskBand", "coverageStatus"],
      properties: {
        riskBand: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        coverageStatus: { type: "string", enum: ["OK", "WARNING", "ALERT"] },
      },
    },
  },
} as const;

export const RegulatorComplianceEvidencePackQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["orgId", "period"],
  properties: {
    orgId: { type: "string" },
    period: { type: "string" },
  },
} as const;

export const RegulatorComplianceEvidencePackReplySchema = {
  type: "object",
  additionalProperties: true,
  required: ["version", "generatedAt", "orgId", "period", "evidenceChecksum", "payload"],
  properties: {
    version: { type: "integer", enum: [1] },
    generatedAt: { type: "string" },

    orgId: { type: "string" },
    period: { type: "string" },

    specIdFull: { type: "string" },
    specVersionHash: { type: "string" },

    inputHash: { type: "string" },
    outputHash: { type: "string" },

    evidenceChecksum: { type: "string" },

    payload: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;
