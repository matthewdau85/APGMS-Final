import { describe, expect, it, jest } from "@jest/globals";

async function loadMetricsModule() {
  jest.resetModules();

  await jest.unstable_mockModule("prom-client", () => {
    const counter = jest.fn().mockImplementation(() => {
      const inc = jest.fn();
      const labels = jest.fn(() => ({ inc: jest.fn() }));
      return { inc, labels };
    });

    const histogram = jest.fn().mockImplementation((config: { name: string }) => ({
      config,
      startTimer: jest.fn(() => jest.fn()),
      observe: jest.fn(),
      labels: jest.fn(() => ({
        observe: jest.fn(),
        startTimer: jest.fn(() => jest.fn()),
      })),
    }));

    return {
      __esModule: true,
      Counter: counter,
      Histogram: histogram,
      collectDefaultMetrics: jest.fn(),
      register: { metrics: jest.fn(), contentType: "text/plain", clear: jest.fn() },
    };
  });

  const module = await import("../src/observability/metrics.js");
  return module.metrics;
}

describe("metrics.observeJob", () => {
  it("records job duration on success", async () => {
    const metrics = await loadMetricsModule();
    const jobHistogram = metrics.jobDuration;
    expect(jobHistogram).toBeDefined();
    const stop = jest.fn();
    const startTimer = jest.fn(() => stop);
    jobHistogram!.startTimer = startTimer as unknown as typeof jobHistogram.startTimer;

    const result = await metrics.observeJob("anomaly.snapshot", async () => "ok");

    expect(result).toBe("ok");
    expect(startTimer).toHaveBeenCalledWith({ job: "anomaly.snapshot" });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("stops the timer even when the job throws", async () => {
    const metrics = await loadMetricsModule();
    const jobHistogram = metrics.jobDuration;
    expect(jobHistogram).toBeDefined();
    const stop = jest.fn();
    const startTimer = jest.fn(() => stop);
    jobHistogram!.startTimer = startTimer as unknown as typeof jobHistogram.startTimer;

    await expect(
      metrics.observeJob("anomaly.failure", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(startTimer).toHaveBeenCalledWith({ job: "anomaly.failure" });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("exposes helpers for other metrics", async () => {
    const metrics = await loadMetricsModule();
    const counter = metrics.httpRequestTotal.labels("GET", "/ready", "200");

    expect(counter.inc).toBeDefined();
    expect(typeof counter.inc).toBe("function");
  });
});
