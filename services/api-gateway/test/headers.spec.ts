import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";

const buildPrismaStub = () =>
  ({
    $queryRaw: async () => 1,
    org: {},
    user: {},
    bankLine: {},
    orgTombstone: {},
    $transaction: async (cb: (tx: unknown) => unknown) => cb({}),
  }) as unknown as PrismaClient;

test("security headers present", async (t) => {
  const app = await createApp({ prisma: buildPrismaStub() });
  await app.ready();

  t.after(async () => {
    await app.close();
  });

  const res = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.match(res.headers["x-frame-options"] ?? "", /DENY/i);
  assert.ok(res.headers["content-security-policy"]);
});

test("rejects unknown origins", async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowlist = process.env.CORS_ALLOWLIST;

  process.env.NODE_ENV = "production";
  process.env.CORS_ALLOWLIST = "https://allowed.test";

  const app = await createApp({ prisma: buildPrismaStub() });
  await app.ready();

  t.after(async () => {
    await app.close();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalAllowlist === undefined) {
      delete process.env.CORS_ALLOWLIST;
    } else {
      process.env.CORS_ALLOWLIST = originalAllowlist;
    }
  });

  const res = await app.inject({
    method: "GET",
    url: "/health",
    headers: { origin: "https://blocked.test" },
  });

  assert.equal(res.headers["access-control-allow-origin"], undefined);
});
