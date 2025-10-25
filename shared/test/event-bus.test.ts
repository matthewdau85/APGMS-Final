import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { InMemoryEventBus } from "../src/messaging/in-memory-bus.js";
import type { BusEnvelope } from "../src/messaging/event-bus.js";

describe("InMemoryEventBus", () => {
  it("invokes subscribers with payload", async () => {
    const bus = new InMemoryEventBus();
    let callCount = 0;

    const unsubscribe = await bus.subscribe("subject", "durable", async (message: BusEnvelope) => {
      callCount += 1;
      assert.equal(message.orgId, "org-123");
    });

    await bus.publish("subject", {
      id: "evt-1",
      orgId: "org-123",
      eventType: "test",
      key: "org-123",
      ts: new Date().toISOString(),
      schemaVersion: "v1",
      source: "test",
      dedupeId: "dup-1",
      payload: { amount: 1000 },
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(callCount, 1);
    await unsubscribe();
  });
});
