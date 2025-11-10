import assert from "node:assert/strict";
import test from "node:test";
import { createMlServiceClient } from "../../../services/api-gateway/src/clients/mlServiceClient.js";
import { shouldBlockTransfer, shouldDeferReadiness } from "../../../services/api-gateway/src/lib/risk.js";

test("ml client hits shortfall endpoint and parses response", async () => {
  const calls: Array<{ url: string; body: string | undefined }> = [];
  const fakeFetch = async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body as string | undefined });
    return new Response(
      JSON.stringify({
        orgId: "demo",
        score: 0.91,
        riskLevel: "high",
        recommendedAction: "Block",
        explanations: ["demo"],
        factors: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  const client = createMlServiceClient("http://ml-service/", fakeFetch as typeof fetch);
  const result = await client.evaluateShortfallRisk({
    orgId: "demo",
    cashOnHand: 10,
    upcomingObligations: 100,
    openHighAlerts: 2,
    lodgmentCompletionRatio: 0.2,
    volatilityIndex: 0.5,
  });

  assert.equal(result.riskLevel, "high");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/risk\/shortfall$/);
  assert.ok(calls[0].body?.includes("\"orgId\":\"demo\""));
});

test("gating helpers block when risk is high", () => {
  const assessment = {
    orgId: "demo",
    score: 0.82,
    riskLevel: "high" as const,
    recommendedAction: "Stop",
    explanations: ["outlier"],
  };

  assert.equal(shouldBlockTransfer(assessment), true);
  assert.equal(shouldDeferReadiness(assessment), true);
});

test("gating helpers allow when risk is low", () => {
  const assessment = {
    orgId: "demo",
    score: 0.12,
    riskLevel: "low" as const,
    recommendedAction: "Proceed",
    explanations: ["normal"],
  };

  assert.equal(shouldBlockTransfer(assessment), false);
  assert.equal(shouldDeferReadiness(assessment), false);
});
