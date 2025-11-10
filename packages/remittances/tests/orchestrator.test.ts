import {
  ManualReviewQueue,
  RemittanceOrchestrator,
  RemittanceRetryQueue,
  type FraudDetector,
  type RemittanceRequest,
} from "../src/orchestrator";

describe("RemittanceOrchestrator", () => {
  const request: RemittanceRequest = {
    id: "remit-1",
    orgId: "org-1",
    amountCents: 125_00,
    currency: "AUD",
    beneficiary: "ACME PTY LTD",
  };

  const buildDetector = (verdict: { risk: "low" | "medium" | "high"; reasons?: string[] }) => {
    return {
      evaluate: jest.fn(async () => ({
        risk: verdict.risk,
        reasons: verdict.reasons ?? [],
      })),
    } satisfies FraudDetector;
  };

  it("falls back to secondary detector when the primary fails", async () => {
    const manualQueue = new ManualReviewQueue();
    const retryQueue = new RemittanceRetryQueue();

    const primary: FraudDetector = {
      evaluate: jest.fn(async () => {
        throw new Error("model-offline");
      }),
    };
    const fallback = buildDetector({ risk: "medium", reasons: ["velocity"] });

    const orchestrator = new RemittanceOrchestrator({
      primaryDetector: primary,
      fallbackDetector: fallback,
      manualQueue,
      retryQueue,
    });

    const metrics: Array<{ metric: string; labels: Record<string, string> }> = [];
    orchestrator.on("metric", (payload) => metrics.push(payload));

    await orchestrator.process(request, async () => Promise.resolve());

    expect(primary.evaluate).toHaveBeenCalled();
    expect(fallback.evaluate).toHaveBeenCalled();
    expect(manualQueue.size).toBe(0);
    expect(metrics.find((entry) => entry.metric === "remittance_detection_fallback_total")).toBeDefined();
  });

  it("routes high-risk remittances to manual review", async () => {
    const manualQueue = new ManualReviewQueue();
    const retryQueue = new RemittanceRetryQueue();

    const primary = buildDetector({ risk: "high", reasons: ["rule.cross_border"] });
    const fallback = buildDetector({ risk: "high", reasons: ["rule.cross_border"] });

    const orchestrator = new RemittanceOrchestrator({
      primaryDetector: primary,
      fallbackDetector: fallback,
      manualQueue,
      retryQueue,
    });

    const metrics: Array<{ metric: string; labels: Record<string, string> }> = [];
    orchestrator.on("metric", (payload) => metrics.push(payload));

    await orchestrator.process(request, async () => Promise.resolve());

    expect(manualQueue.size).toBe(1);
    const manualItem = manualQueue.drain()[0];
    expect(manualItem.reasons).toContain("rule.cross_border");
    expect(metrics.some((entry) => entry.metric === "remittance_manual_reviews_total")).toBe(true);
  });

  it("schedules retries and emits observability signals when execution fails", async () => {
    const manualQueue = new ManualReviewQueue();
    const retryQueue = new RemittanceRetryQueue(3);
    const scheduled: any[] = [];
    retryQueue.on("scheduled", (payload) => scheduled.push(payload));

    const primary = buildDetector({ risk: "low" });
    const fallback = buildDetector({ risk: "low" });

    const orchestrator = new RemittanceOrchestrator({
      primaryDetector: primary,
      fallbackDetector: fallback,
      manualQueue,
      retryQueue,
    });

    const metrics: Array<{ metric: string; labels: Record<string, string> }> = [];
    orchestrator.on("metric", (payload) => metrics.push(payload));

    await orchestrator.process(request, async () => {
      throw new Error("nats-timeout");
    });

    expect(manualQueue.size).toBe(0);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].attempt).toBe(1);
    expect(metrics.some((entry) => entry.metric === "remittance_retry_scheduled_total")).toBe(true);
    expect(metrics.some((entry) => entry.metric === "remittance_decision_latency_ms")).toBe(true);
  });
});
