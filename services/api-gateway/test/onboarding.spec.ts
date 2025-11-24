import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import Fastify from "fastify";

import { registerOnboardingRoutes } from "../src/routes/onboarding";
import {
  configurePIIProviders,
  type AuditLogger,
  type KeyManagementService,
  type TokenSaltProvider,
} from "../src/lib/pii";
import type { PayToProvider } from "../../providers/payto/index.js";

const TEST_KEY = Buffer.alloc(32, 7);
const TEST_SALT = Buffer.alloc(32, 9);

const kms: KeyManagementService = {
  getActiveKey: () => ({ kid: "test-kid", material: TEST_KEY }),
  getKeyById: (kid: string) =>
    kid === "test-kid" ? { kid: "test-kid", material: TEST_KEY } : undefined,
};

const saltProvider: TokenSaltProvider = {
  getActiveSalt: () => ({ sid: "salt-test", secret: TEST_SALT }),
  getSaltById: (sid: string) =>
    sid === "salt-test" ? { sid: "salt-test", secret: TEST_SALT } : undefined,
};

const auditEvents: Array<{ action: string; metadata: unknown }> = [];

beforeEach(() => {
  auditEvents.length = 0;
  const auditLogger: AuditLogger = {
    record: async (event) => {
      auditEvents.push({ action: event.action, metadata: event.metadata ?? null });
    },
  };
  configurePIIProviders({ kms, saltProvider, auditLogger });
});

describe("onboarding validation", () => {
  it("tokenises TFNs and masks PayTo payloads", async () => {
    const app = Fastify();
    let payToCalledWith: any;
    const payto: PayToProvider = {
      id: "mock",
      async initiateMandate(request) {
        payToCalledWith = request;
        return {
          provider: "mock",
          mandateId: "mandate-123",
          status: "pending",
          submittedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
          reference: request.reference,
        };
      },
    };

    await registerOnboardingRoutes(app, {
      payToProvider: payto,
      auditLogger: async (entry) => {
        auditEvents.push({ action: entry.action, metadata: entry.metadata });
      },
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/validate",
      payload: {
        abn: "51 824 753 556",
        tfn: "123 456 788",
        orgName: "Demo Org",
        contactEmail: "ops@example.com",
        bank: {
          accountName: "Demo Org",
          bsb: "123456",
          accountNumber: "1234567",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      tfnToken: string;
      secret: { ciphertext: string; kid: string };
      mandate: { provider: string };
    };

    assert.equal(body.mandate.provider, "mock");
    assert.ok(body.tfnToken.startsWith("salt-test."));
    assert.ok(body.secret.ciphertext.length > 16);
    assert.ok(!body.tfnToken.includes("123456788"));
    assert.ok(!JSON.stringify(body).includes("123456788"));

    assert.ok(payToCalledWith);
    assert.equal(payToCalledWith.orgId, "51824753556");
    assert.equal(payToCalledWith.amountCents, 100);
    assert.equal(payToCalledWith.reference, "verify-51824753556");

    assert.equal(auditEvents.length > 0, true);

    await app.close();
  });

  it("accepts formatted TFNs during onboarding", async () => {
    const app = Fastify();
    let payToCalledWith: any;
    const payto: PayToProvider = {
      id: "mock",
      async initiateMandate(request) {
        payToCalledWith = request;
        return {
          provider: "mock",
          mandateId: "mandate-123",
          status: "pending",
          submittedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
          reference: request.reference,
        };
      },
    };

    await registerOnboardingRoutes(app, { payToProvider: payto });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/validate",
      payload: {
        abn: "51 824 753 556",
        tfn: "123-456-788",
        orgName: "Demo Org",
        bank: {
          accountName: "Demo Org",
          bsb: "123456",
          accountNumber: "1234567",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      tfnToken: string;
      secret: { ciphertext: string; kid: string };
    };

    assert.ok(body.tfnToken.startsWith("salt-test."));
    assert.ok(!body.tfnToken.includes("123456788"));
    assert.ok(!JSON.stringify(body).includes("123456788"));

    assert.ok(payToCalledWith);
    assert.equal(payToCalledWith.orgId, "51824753556");

    await app.close();
  });

  it("rejects invalid TFNs", async () => {
    const app = Fastify();
    const rejectingProvider: PayToProvider = {
      id: "mock",
      async initiateMandate() {
        throw new Error("should not be called");
      },
    };
    await registerOnboardingRoutes(app, { payToProvider: rejectingProvider });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/onboarding/validate",
      payload: {
        abn: "51 824 753 556",
        tfn: "123123123",
        orgName: "Bad Org",
        bank: {
          accountName: "Bad Org",
          bsb: "123456",
          accountNumber: "1234567",
        },
      },
    });

    assert.equal(response.statusCode, 400);
    await app.close();
  });
});
