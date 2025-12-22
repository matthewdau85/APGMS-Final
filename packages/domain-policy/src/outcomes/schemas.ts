// packages/domain-policy/src/outcomes/schemas.ts

// JSON Schemas are provided as plain JS objects so they ship in dist without JSON module config.

export const OutcomeSpecV1Schema = {
  $id: "apgms/outcome-spec-v1.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "version", "jurisdiction", "domain", "approval", "outcomes"],
  properties: {
    schemaVersion: { const: "outcome-spec-v1" },
    id: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    jurisdiction: { const: "AU" },
    domain: { const: "BAS" },
    approval: {
      type: "object",
      additionalProperties: false,
      required: ["approvedBy", "approvedAt"],
      properties: {
        approvedBy: { type: "string", minLength: 1 },
        approvedAt: { type: "string", minLength: 1 },
        reference: { type: "string" },
      },
    },
    outcomes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "fields"],
        properties: {
          id: { type: "string", minLength: 1 },
          description: { type: "string" },
          fields: {
            type: "object",
            additionalProperties: {
              type: "object",
              additionalProperties: false,
              required: ["type", "expr"],
              properties: {
                type: { enum: ["number", "string", "boolean"] },
                expr: { type: "object" }, // DSL object; validated by compiler
              },
            },
          },
        },
      },
    },
  },
} as const;

export const BasOutcomeV1Schema = {
  $id: "apgms/bas-outcome-v1.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "orgId", "period", "taxSpec", "computedAt", "metrics", "hash"],
  properties: {
    schemaVersion: { const: "bas-outcome-v1" },
    orgId: { type: "string" },
    period: { type: "string" },
    taxSpec: {
      type: "object",
      additionalProperties: false,
      required: ["id", "version", "jurisdiction"],
      properties: {
        id: { type: "string" },
        version: { type: "string" },
        jurisdiction: { type: "string" },
      },
    },
    computedAt: { type: "string" },
    metrics: {
      type: "object",
      additionalProperties: false,
      required: [
        "paygwDueCents",
        "gstDueCents",
        "totalDueCents",
        "paygwHeldCents",
        "gstHeldCents",
        "totalHeldCents",
        "paygwShortfallCents",
        "gstShortfallCents",
        "totalShortfallCents",
        "basCoverageRatio",
        "riskBand",
      ],
      properties: {
        paygwDueCents: { type: "number" },
        gstDueCents: { type: "number" },
        totalDueCents: { type: "number" },
        paygwHeldCents: { type: "number" },
        gstHeldCents: { type: "number" },
        totalHeldCents: { type: "number" },
        paygwShortfallCents: { type: "number" },
        gstShortfallCents: { type: "number" },
        totalShortfallCents: { type: "number" },
        basCoverageRatio: { type: "number" },
        riskBand: { enum: ["LOW", "MEDIUM", "HIGH"] },
      },
    },
    hash: { type: "string" },
  },
} as const;
