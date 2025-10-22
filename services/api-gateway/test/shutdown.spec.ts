import assert from "node:assert/strict";
import { test } from "node:test";

import type { FastifyInstance } from "fastify";

import { setupSignalHandlers } from "../src/shutdown";

test("setupSignalHandlers gracefully shuts down on SIGTERM", async () => {
  let closed = false;
  const app = {
    close: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      closed = true;
    },
    log: {
      info: () => {},
      error: () => {},
    },
  } as unknown as FastifyInstance;

  const originalExit = process.exit;
  const exitCalls: Array<number | undefined> = [];
  (process as any).exit = (code?: number) => {
    exitCalls.push(code);
    return undefined as never;
  };

  const cleanup = setupSignalHandlers(app, { timeoutMs: 50 });

  try {
    process.emit("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(closed, true);
    assert.deepEqual(exitCalls, [0]);
  } finally {
    cleanup();
    (process as any).exit = originalExit;
  }
});
