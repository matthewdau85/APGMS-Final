// packages/domain-policy/src/outcomes/spec.ts

import type { Expr } from "./expr.js";

export type FieldType = "number" | "string" | "boolean";

export interface OutcomeFieldSpec {
  type: FieldType;
  expr: Expr;
}

export interface OutcomeDefinition {
  id: string;
  description?: string;
  fields: Record<string, OutcomeFieldSpec>;
}

export interface OutcomeSpecV1 {
  schemaVersion: "outcome-spec-v1";
  id: string;
  version: string;

  jurisdiction: "AU";
  domain: "BAS";

  approval: {
    approvedBy: string;
    approvedAt: string; // ISO
    reference?: string;
  };

  outcomes: OutcomeDefinition[];
}

export function validateOutcomeSpecV1OrThrow(spec: OutcomeSpecV1): void {
  const missing: string[] = [];

  if (spec.schemaVersion !== "outcome-spec-v1") missing.push("schemaVersion");
  if (!spec.id) missing.push("id");
  if (!spec.version) missing.push("version");
  if (!spec.jurisdiction) missing.push("jurisdiction");
  if (!spec.domain) missing.push("domain");
  if (!spec.approval?.approvedBy) missing.push("approval.approvedBy");
  if (!spec.approval?.approvedAt) missing.push("approval.approvedAt");
  if (!spec.outcomes?.length) missing.push("outcomes");

  if (missing.length) {
    throw new Error(`Outcome spec invalid: missing/invalid fields: ${missing.join(", ")}`);
  }

  const ids = new Set<string>();
  for (const o of spec.outcomes) {
    if (!o.id) throw new Error("Outcome spec invalid: outcome missing id");
    if (ids.has(o.id)) throw new Error(`Outcome spec invalid: duplicate outcome id: ${o.id}`);
    ids.add(o.id);
    if (!o.fields || Object.keys(o.fields).length === 0) {
      throw new Error(`Outcome spec invalid: outcome ${o.id} has no fields`);
    }
  }
}
