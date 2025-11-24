import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { helmetConfigFor } from "../src/security-headers";
import type { AppConfig } from "../src/config";

const config: AppConfig = {
  databaseUrl: "postgres://localhost:5432/apgms",
  shadowDatabaseUrl: undefined,
  rateLimit: { max: 100, window: "1 minute" },
  security: {
    authFailureThreshold: 5,
    kmsKeysetLoaded: true,
    requireHttps: false,
  },
  cors: {
    allowedOrigins: ["http://localhost:5173", "https://example.com"],
  },
  taxEngineUrl: "https://tax.example.com",
  auth: {
    audience: "aud",
    issuer: "iss",
    devSecret: "devsecret",
  },
  regulator: {
    accessCode: "code",
    jwtAudience: "reg-aud",
    sessionTtlMinutes: 30,
  },
  encryption: { masterKey: Buffer.alloc(32, 1) },
  webauthn: {
    rpId: "localhost",
    rpName: "APGMS",
    origin: "http://localhost:3000",
  },
  banking: {
    providerId: "mock",
    maxReadTransactions: 100,
    maxWriteCents: 10_000,
  },
  redis: undefined,
  nats: undefined,
};

const buildSecureApp = async (
  registerRoutes: (app: FastifyInstance) => void | Promise<void>,
) => {
  const app = Fastify();
  await app.register(cors, { origin: config.cors.allowedOrigins });
  await app.register(helmet, helmetConfigFor(config));
  await registerRoutes(app);
  return app;
};

describe("security headers runtime", () => {
  it("applies CSP/frameguard/referrer-policy/HSTS", async () => {
    const app = await buildSecureApp((instance) => {
      instance.get("/", async () => ({ ok: true }));
    });

    try {
      const res = await app.inject({ method: "GET", url: "/" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-security-policy"]).toBeTruthy();
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toMatch(/no-referrer/i);
      expect(res.headers["strict-transport-security"]).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("applies CSP/frameguard/referrer-policy/HSTS on protected routes", async () => {
    const app = await buildSecureApp((instance) => {
      instance.addHook("onRequest", (req, _reply, done) => {
        (req as any).user = { orgId: "org-123", sub: "user-123", role: "admin" };
        done();
      });

      instance.get("/bank-lines", async (request, reply) => {
        if (!(request as any).user) {
          reply.code(401).send({ error: "unauthenticated" });
          return;
        }
        return { lines: [] };
      });
    });

    try {
      const res = await app.inject({ method: "GET", url: "/bank-lines" });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-security-policy"]).toBeTruthy();
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toMatch(/no-referrer/i);
      expect(res.headers["strict-transport-security"]).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});
