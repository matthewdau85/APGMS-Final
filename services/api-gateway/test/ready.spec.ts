import { after, before, describe, it, test } from "node:test";
import assert from "node:assert/strict";

const runReadySuite = process.env.RUN_READY_SUITE === "true";

if (!runReadySuite) {
  test.skip("Readiness integration test requires RUN_READY_SUITE=true", () => {});
} else {
  const { createApp } = await import("../src/app");
  const { prisma } = await import("@apgms/shared/db");

  let app: Awaited<ReturnType<typeof createApp>>;

  describe("/health/ready", () => {
    before(async () => {
      app = await createApp();
      await app.ready();
    });

    after(async () => {
      await app.close();
      await prisma.$disconnect();
    });

    it("returns 200 when DB is reachable", async () => {
      const res = await app.inject({ method: "GET", url: "/health/ready" });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { ok: true, checks: { db: true } });
    });
  });
}
