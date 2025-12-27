import test from "node:test";
import assert from "node:assert/strict";

test("worker: workspace dependency resolution is wired", async () => {
  const mod = await import("@apgms/shared");
  assert.ok(mod, "expected @apgms/shared to be importable");
});
