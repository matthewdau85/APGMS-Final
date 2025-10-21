import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "@apgms/shared/db";

let app: Awaited<ReturnType<typeof createApp>>;
describe("/ready", () => {
  beforeAll(async () => { app = await createApp(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it("returns 200 when DB is reachable", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ready: true });
  });
});
