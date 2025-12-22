// packages/domain-policy/src/outcomes/specs/bas-outcomes.v1.ts

import type { OutcomeSpecV1 } from "../spec.js";

export const BAS_OUTCOME_SPEC_V1: OutcomeSpecV1 = {
  schemaVersion: "outcome-spec-v1",
  id: "AU-BAS-OUTCOMES",
  version: "1.0.0",
  jurisdiction: "AU",
  domain: "BAS",
  approval: {
    approvedBy: "apgms-admin",
    approvedAt: "2025-12-22T00:00:00.000Z",
    reference: "bootstrap-v1",
  },
  outcomes: [
    {
      id: "bas_compliance_summary_v1",
      description: "Core BAS compliance summary metrics used by gateway + regulator views.",
      fields: {
        paygwDueCents: { type: "number", expr: { op: "path", path: "obligations.paygwCents" } },
        gstDueCents: { type: "number", expr: { op: "path", path: "obligations.gstCents" } },
        totalDueCents: {
          type: "number",
          expr: { op: "add", args: [
            { op: "path", path: "obligations.paygwCents" },
            { op: "path", path: "obligations.gstCents" },
          ] },
        },

        paygwHeldCents: { type: "number", expr: { op: "path", path: "ledger.paygwCents" } },
        gstHeldCents: { type: "number", expr: { op: "path", path: "ledger.gstCents" } },
        totalHeldCents: {
          type: "number",
          expr: { op: "add", args: [
            { op: "path", path: "ledger.paygwCents" },
            { op: "path", path: "ledger.gstCents" },
          ] },
        },

        paygwShortfallCents: {
          type: "number",
          expr: {
            op: "max",
            args: [
              { op: "const", value: 0 },
              { op: "sub", a: { op: "path", path: "obligations.paygwCents" }, b: { op: "path", path: "ledger.paygwCents" } },
            ],
          },
        },
        gstShortfallCents: {
          type: "number",
          expr: {
            op: "max",
            args: [
              { op: "const", value: 0 },
              { op: "sub", a: { op: "path", path: "obligations.gstCents" }, b: { op: "path", path: "ledger.gstCents" } },
            ],
          },
        },
        totalShortfallCents: {
          type: "number",
          expr: { op: "add", args: [
            { op: "path", path: "derived.paygwShortfallCents" },
            { op: "path", path: "derived.gstShortfallCents" },
          ] },
        },

        basCoverageRatio: {
          type: "number",
          // If totalDueCents is 0, treat as fully covered (ratio 1).
          expr: {
            op: "if",
            cond: { op: "eq", a: { op: "path", path: "derived.totalDueCents" }, b: { op: "const", value: 0 } },
            then: { op: "const", value: 1 },
            else: {
              op: "round",
              value: {
                op: "div",
                a: { op: "path", path: "derived.totalHeldCents" },
                b: { op: "path", path: "derived.totalDueCents" },
                default: 0,
              },
              decimals: 4,
            },
          },
        },

        // Keep the same thresholds your gateway tests assume (LOW >= 0.9, MEDIUM >= 0.6 else HIGH).
        riskBand: {
          type: "string",
          expr: {
            op: "if",
            cond: { op: "gte", a: { op: "path", path: "derived.basCoverageRatio" }, b: { op: "const", value: 0.9 } },
            then: { op: "const", value: "LOW" },
            else: {
              op: "if",
              cond: { op: "gte", a: { op: "path", path: "derived.basCoverageRatio" }, b: { op: "const", value: 0.6 } },
              then: { op: "const", value: "MEDIUM" },
              else: { op: "const", value: "HIGH" },
            },
          },
        } as any,
      },
    },
  ],
};
