import { setTimeout as delay } from "node:timers/promises";

export class BasIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BasIntegrationError";
  }
}

export type BasIntegrationInput = {
  basCycleId: string;
  orgId: string;
};

const DEFAULT_LATENCY_MS = 150;

export async function executeBasLodgmentIntegration(
  input: BasIntegrationInput,
): Promise<void> {
  const mode = process.env.BAS_INTEGRATION_MODE ?? "success";
  const latency = Number(process.env.BAS_INTEGRATION_LATENCY_MS ?? DEFAULT_LATENCY_MS);

  await delay(Number.isFinite(latency) ? latency : DEFAULT_LATENCY_MS);

  if (mode === "fail") {
    throw new BasIntegrationError(
      `Core BAS integration unavailable for cycle ${input.basCycleId}`,
    );
  }

  if (mode === "degraded") {
    // Simulate a transient failure probability
    const threshold = Number(process.env.BAS_INTEGRATION_DEGRADED_THRESHOLD ?? 0.3);
    if (Math.random() < threshold) {
      throw new BasIntegrationError(
        `Transient BAS integration failure for cycle ${input.basCycleId}`,
      );
    }
  }
}

export default executeBasLodgmentIntegration;
