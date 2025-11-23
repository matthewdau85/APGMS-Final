import { helmetConfigFor } from "../src/security-headers";
import type { AppConfig } from "../src/config";

describe("helmet configuration", () => {
  it("sets strict CSP and includes allowed origins for connect-src", () => {
    const cfg: AppConfig = {
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

    const helmetCfg = helmetConfigFor(cfg);

    expect(helmetCfg.frameguard).toEqual({ action: "deny" });
    expect(helmetCfg.referrerPolicy).toEqual({ policy: "no-referrer" });
    expect(helmetCfg.crossOriginResourcePolicy).toEqual({
      policy: "same-site",
    });

    const csp = helmetCfg.contentSecurityPolicy as any;
    const directives = csp?.directives as
      | {
          defaultSrc?: string[];
          baseUri?: string[];
          connectSrc?: string[];
          scriptSrc?: string[];
          styleSrc?: string[];
          imgSrc?: string[];
          objectSrc?: string[];
          frameAncestors?: string[];
        }
      | undefined;

    expect(directives).toBeDefined();
    expect(directives?.defaultSrc).toContain("'self'");
    expect(directives?.connectSrc).toEqual(["'self'", ...cfg.cors.allowedOrigins]);
    expect(directives?.frameAncestors).toEqual(["'none'"]);
    expect(directives?.objectSrc).toEqual(["'none'"]);
  });
});
