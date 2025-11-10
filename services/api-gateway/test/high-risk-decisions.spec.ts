import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createDecisionStoreForTesting,
} from "../src/lib/high-risk-decisions.js";

const auditEntries: any[] = [];
const auditLogger = async (entry: any) => {
  auditEntries.push(entry);
};

describe("HighRiskDecisionStore", () => {
  it("records feedback and appends audit entries", async () => {
    const store = createDecisionStoreForTesting(auditLogger);
    auditEntries.length = 0;

    await store.registerDecision({
      id: "dec-1",
      orgId: "org-1",
      model: "fraud-model",
      riskScore: 0.92,
    });

    const result = await store.addFeedback({
      decisionId: "dec-1",
      orgId: "org-1",
      actorId: "user-1",
      outcome: "false_positive",
      note: "documented via manual review",
    });

    assert.equal(result.status, "feedback_provided");
    assert.equal(result.history.at(-1)?.action, "human.feedback.false_positive");
    assert.equal(auditEntries.length, 1);
    assert.deepEqual(auditEntries[0], {
      orgId: "org-1",
      actorId: "user-1",
      action: "ml.decision.feedback",
      metadata: {
        decisionId: "dec-1",
        outcome: "false_positive",
        note: "documented via manual review",
      },
    });
  });

  it("allows overrides with audit trail", async () => {
    const store = createDecisionStoreForTesting(auditLogger);
    auditEntries.length = 0;

    await store.registerDecision({
      id: "dec-2",
      orgId: "org-1",
      model: "fraud-model",
      riskScore: 0.97,
    });

    const result = await store.overrideDecision({
      decisionId: "dec-2",
      orgId: "org-1",
      actorId: "admin-1",
      resolution: "approve",
      note: "urgent payroll release",
    });

    assert.equal(result.status, "overridden");
    assert.equal(result.history.at(-1)?.action, "human.override.approve");
    assert.equal(auditEntries.length, 1);
    assert.deepEqual(auditEntries[0], {
      orgId: "org-1",
      actorId: "admin-1",
      action: "ml.decision.override",
      metadata: {
        decisionId: "dec-2",
        resolution: "approve",
        note: "urgent payroll release",
      },
    });
  });
});
