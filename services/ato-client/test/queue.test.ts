import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { LodgmentQueue } from "../src/client.js";

describe("LodgmentQueue", () => {
  it("applies exponential backoff and eventual exhaustion", () => {
    const queue = new LodgmentQueue(3, 10);
    queue.enqueue({
      lodgmentId: "abc",
      type: "STP",
      payload: { id: "abc" },
      attempts: 0,
      nextAttemptAt: 0,
    });

    const first = queue.drainReady(0);
    assert.equal(first.length, 1);

    const failure1 = queue.markFailure("abc", new Error("boom"));
    assert.ok(failure1);
    if (!failure1) throw new Error("failure1 missing");
    assert.ok(failure1.nextAttemptAt > 0);

    queue.drainReady(0);
    const failure2 = queue.markFailure("abc", new Error("boom"));
    assert.ok(failure2);
    if (!failure2) throw new Error("failure2 missing");
    assert.ok(failure2.nextAttemptAt > failure1.nextAttemptAt);

    const failure3 = queue.markFailure("abc", new Error("boom"));
    assert.ok(failure3);
    if (!failure3) throw new Error("failure3 missing");
    assert.equal(failure3.nextAttemptAt, Number.POSITIVE_INFINITY);
  });
});

