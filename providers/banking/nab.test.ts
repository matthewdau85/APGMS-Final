import assert from "node:assert/strict";
import { test } from "node:test";

import { createBankingProvider } from "./index.js";
import { NabClient, NabClientError } from "./nab-client.js";
import { NabBankingProvider } from "./nab.js";

test("createBankingProvider wires custom NAB client", () => {
  const fakeClient = {
    async creditDesignatedAccount() {
      return { reference: "fake", status: "accepted" } as const;
    },
  };
  const provider = createBankingProvider("nab", { nab: { client: fakeClient as any } });
  assert.ok(provider instanceof NabBankingProvider);
  assert.equal(Reflect.get(provider as any, "client"), fakeClient);
});

test("NabClient surfaces non-OK responses", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ error: "quota" }), { status: 429, headers: { "content-type": "application/json" } });
  const client = new NabClient(
    {
      baseUrl: "https://sandbox.nab.invalid/api",
      clientId: "client",
      clientSecret: "secret",
    },
    fetchImpl,
  );

  await assert.rejects(
    () =>
      client.creditDesignatedAccount({
        orgId: "org",
        accountId: "acct",
        amountCents: 1234,
        reference: "transfer",
      }),
    (error: unknown) => error instanceof NabClientError && error.statusCode === 429,
  );
});

test("NabClient returns reference data on success", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ reference: "abc123", status: "accepted" }), { status: 201 });
  const client = new NabClient(
    {
      baseUrl: "https://sandbox.nab.invalid/api",
      clientId: "client",
      clientSecret: "secret",
    },
    fetchImpl,
  );

  const result = await client.creditDesignatedAccount({
    orgId: "org",
    accountId: "acct",
    amountCents: 500,
    reference: "transfer",
  });

  assert.equal(result.reference, "abc123");
  assert.equal(result.status, "accepted");
});
