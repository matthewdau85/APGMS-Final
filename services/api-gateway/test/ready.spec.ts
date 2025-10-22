import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "@apgms/shared/db";

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "test-auth-secret";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "https://issuer.example.com";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "apgms-api";
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "test-admin-token";

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
