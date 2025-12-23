// services/api-gateway/src/routes/schemas.ts

export const MoneyCentsSchema = { type: "integer" } as const;

export const ObligationsBreakdownItemSchema = {
  type: "object",
  properties: {
    source: { type: "string" },
    amountCents: MoneyCentsSchema,
  },
  required: ["source", "amountCents"],
  additionalProperties: true,
} as const;

export const ObligationsSchema = {
  type: "object",
  properties: {
    paygwCents: MoneyCentsSchema,
    gstCents: MoneyCentsSchema,
    breakdown: {
      type: "array",
      items: ObligationsBreakdownItemSchema,
    },
  },
  required: ["paygwCents", "gstCents"],
  additionalProperties: true,
} as const;

export const LedgerSchema = {
  type: "object",
  properties: {
    paygwCents: MoneyCentsSchema,
    gstCents: MoneyCentsSchema,
    totalCents: MoneyCentsSchema,
  },
  required: ["paygwCents", "gstCents", "totalCents"],
  additionalProperties: true,
} as const;

export const RiskSchema = {
  type: "object",
  properties: {
    riskBand: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    coverageStatus: { type: "string", enum: ["OK", "WARN", "ALERT"] },
  },
  required: ["riskBand", "coverageStatus"],
  additionalProperties: true,
} as const;

export const RegulatorComplianceSummaryQuerySchema = {
  type: "object",
  properties: {
    orgId: { type: "string" },
    period: { type: "string" },
  },
  required: ["period"],
  additionalProperties: false,
} as const;

export const RegulatorComplianceSummaryReplySchema = {
  type: "object",
  properties: {
    orgId: { type: "string" },
    period: { type: "string" },

    obligations: ObligationsSchema,
    ledger: LedgerSchema,

    paygwShortfallCents: MoneyCentsSchema,
    gstShortfallCents: MoneyCentsSchema,
    totalShortfallCents: MoneyCentsSchema,

    basCoverageRatio: { type: "number" },
    risk: RiskSchema,
  },
  required: [
    "orgId",
    "period",
    "obligations",
    "ledger",
    "paygwShortfallCents",
    "gstShortfallCents",
    "totalShortfallCents",
    "basCoverageRatio",
    "risk",
  ],
  // IMPORTANT: keep this true so Fastify doesn't strip anything unexpected
  additionalProperties: true,
} as const;

export const RegulatorComplianceEvidencePackQuerySchema = {
  type: "object",
  properties: {
    orgId: { type: "string" },
    period: { type: "string" },
  },
  required: ["period"],
  additionalProperties: false,
} as const;

export const RegulatorComplianceEvidencePackReplySchema = {
  type: "object",
  properties: {
    version: { type: "integer", enum: [1] },
    orgId: { type: "string" },
    period: { type: "string" },
    generatedAt: { type: "string" },

    obligations: ObligationsSchema,
    ledger: LedgerSchema,

    basCoverageRatio: { type: "number" },
    risk: RiskSchema,

    checksum: { type: "string" },
  },
  required: [
    "version",
    "orgId",
    "period",
    "generatedAt",
    "obligations",
    "ledger",
    "basCoverageRatio",
    "risk",
    "checksum",
  ],
  additionalProperties: true,
} as const;
