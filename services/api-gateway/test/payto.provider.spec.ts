import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NabPayToProvider } from "../../providers/payto/nab.js";
import { MockPayToProvider } from "../../providers/payto/mock.js";
import type { PayToMandateRequest } from "../../providers/payto/types.js";

describe("PayTo providers", () => {
  it("loads credentials from the secret manager", async () => {
    let secretCalls = 0;
    const secretManager = {
      async getSecret(name: string) {
        secretCalls += 1;
        assert.equal(name, "PAYTO_NAB_CREDENTIALS");
        return JSON.stringify({ apiKey: "secret-key" });
      },
    };

    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchStub = async (
      url: string,
      init?: { headers?: Record<string, string> },
    ) => {
      requests.push({
        url,
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      return {
        ok: true,
        async json() {
          return {
            mandateId: "mandate-1",
            status: "pending",
            submittedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
            reference: "verify-123",
            provider: "nab",
          };
        },
        async text() {
          return "";
        },
      } as any;
    };

    const provider = new NabPayToProvider(
      { id: "nab", baseUrl: "https://nab.example/payto/" },
      { secretManager, fetch: fetchStub as any },
    );

    const request: PayToMandateRequest = {
      orgId: "51824753556",
      accountName: "Demo Org",
      bsb: "123456",
      accountNumber: "1234567",
      amountCents: 150,
      description: "Verify account",
      reference: "verify-51824753556",
      contactEmail: "ops@example.com",
    };

    const result = await provider.initiateMandate(request);
    assert.equal(result.provider, "nab");
    assert.equal(secretCalls, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.headers?.Authorization, "Bearer secret-key");
  });

  it("returns deterministic mock responses", async () => {
    const provider = new MockPayToProvider();
    const result = await provider.initiateMandate({
      orgId: "51824753556",
      accountName: "Demo",
      bsb: "123456",
      accountNumber: "1234567",
      amountCents: 100,
      description: "Verify",
      reference: "verify-51824753556",
    });

    assert.equal(result.provider, "mock");
    assert.equal(result.status, "verified");
  });
});
