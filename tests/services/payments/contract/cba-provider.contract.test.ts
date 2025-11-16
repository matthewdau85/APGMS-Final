import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AppError } from "../../../../shared/src/errors.js";

import { CbaBankingApiClient } from "../../../../providers/banking/cba-client.js";

type Fixture = {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
};

const loadFixture = async (name: string): Promise<Fixture> => {
  const file = new URL(`../fixtures/${name}.json`, import.meta.url);
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Fixture;
};

const collectBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const startFixtureServer = async (
  fixture: Fixture,
): Promise<{ url: string; close: () => Promise<void> }> => {
  const server = createServer(async (req, res) => {
    assert.equal(req.method, fixture.request.method);
    assert.equal(req.url, fixture.request.path);
    const bodyText = await collectBody(req);
    assert.ok(bodyText);
    const parsedBody = JSON.parse(bodyText);
    assert.deepEqual(parsedBody, fixture.request.body);
    assert.equal(req.headers["content-type"], fixture.request.headers["content-type"]);
    assert.equal(req.headers.authorization, fixture.request.headers.authorization);

    res.writeHead(fixture.response.status, fixture.response.headers);
    res.end(JSON.stringify(fixture.response.body));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};

test("CBA client matches the recorded sandbox contract", async () => {
  const fixture = await loadFixture("cba-credit-success");
  const server = await startFixtureServer(fixture);

  const client = new CbaBankingApiClient({
    baseUrl: server.url,
    apiKey: "sandbox-key",
    timeoutMs: 2_000,
  });

  await client.createCredit({
    orgId: "org-123",
    actorId: "actor-42",
    accountId: "acct-789",
    amount: 1_250_000,
    reference: "PAYROLL_BATCH_2025-01-01",
  });

  await server.close();
});

test("CBA client surfaces upstream failures", async () => {
  const fixture = await loadFixture("cba-credit-failure");
  const server = await startFixtureServer(fixture);

  const client = new CbaBankingApiClient({
    baseUrl: server.url,
    apiKey: "sandbox-key",
    timeoutMs: 2_000,
  });

  await assert.rejects(
    () =>
      client.createCredit({
        orgId: "org-123",
        actorId: "actor-42",
        accountId: "acct-789",
        amount: 1_250_000,
        reference: "PAYROLL_BATCH_2025-01-01",
      }),
    (error: unknown) => {
      assert(error instanceof AppError);
      assert.equal(error.code, "banking_api_error");
      assert.equal(error.status, fixture.response.status);
      return true;
    },
  );

  await server.close();
});
