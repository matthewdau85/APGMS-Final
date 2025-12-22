// packages/domain-policy/src/outcomes/compiler.ts

import type { Scalar } from "./expr.js";
import { evalExpr } from "./expr.js";
import type { OutcomeSpecV1, OutcomeDefinition } from "./spec.js";
import { validateOutcomeSpecV1OrThrow } from "./spec.js";

export type CompiledOutcome = {
  id: string;
  evaluate: (ctx: unknown) => Record<string, Scalar>;
};

export type CompiledSpec = {
  spec: OutcomeSpecV1;
  outcomes: Record<string, CompiledOutcome>;
  runOutcome: (outcomeId: string, ctx: unknown) => Record<string, Scalar>;
};

function compileOutcome(o: OutcomeDefinition): CompiledOutcome {
  return {
    id: o.id,
    evaluate: (ctx: unknown) => {
      const out: Record<string, Scalar> = {};
      for (const [fieldId, fieldSpec] of Object.entries(o.fields)) {
        const v = evalExpr(fieldSpec.expr, ctx);

        if (fieldSpec.type === "number" && typeof v !== "number") {
          throw new Error(`Outcome ${o.id}.${fieldId} expected number`);
        }
        if (fieldSpec.type === "string" && typeof v !== "string") {
          throw new Error(`Outcome ${o.id}.${fieldId} expected string`);
        }
        if (fieldSpec.type === "boolean" && typeof v !== "boolean") {
          throw new Error(`Outcome ${o.id}.${fieldId} expected boolean`);
        }

        out[fieldId] = v;
      }
      return out;
    },
  };
}

export function compileOutcomeSpecV1(spec: OutcomeSpecV1): CompiledSpec {
  validateOutcomeSpecV1OrThrow(spec);

  const compiled: Record<string, CompiledOutcome> = {};
  for (const o of spec.outcomes) {
    compiled[o.id] = compileOutcome(o);
  }

  return {
    spec,
    outcomes: compiled,
    runOutcome: (outcomeId: string, ctx: unknown) => {
      const c = compiled[outcomeId];
      if (!c) {
        const known = Object.keys(compiled).sort().join(", ");
        throw new Error(`Unknown outcomeId: ${outcomeId}. Known outcomeIds: ${known}`);
      }
      return c.evaluate(ctx);
    },
  };
}
