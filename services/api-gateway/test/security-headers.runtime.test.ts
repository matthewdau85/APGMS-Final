import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "../src/config";
import { helmetConfigFor } from "../src/security-headers";

describe("security headers runtime", () => {
  it("applies CSP/frameguard/referrer-policy/HSTS", async () => {
    const app = Fastify();
    await app.register(cors, { origin: config.cors.allowedOrigins });
    await app.register(helmet, helmetConfigFor(config));
    app.get("/", async () => ({ ok: true }));
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toBeTruthy();
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toMatch(/no-referrer/i);
    expect(res.headers["strict-transport-security"]).toBeTruthy();
  });
});
