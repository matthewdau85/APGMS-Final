import { test } from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "./test-utils";

const defaultPayload = {
  orgId: "org-123",
  date: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  amount: "42.00",
  payee: "Example",
  desc: "Example line",
};

test("unauthenticated requests receive 401", async () => {
  const app = await buildApp();

  const response = await app.inject({ method: "GET", url: "/bank-lines" });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("principals without role receive 403", async () => {
  const app = await buildApp({ tokenRole: "viewer" });

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: { ...defaultPayload },
    headers: { authorization: "Bearer TEST_VIEWER" },
  });

  assert.equal(response.statusCode, 403);

  await app.close();
});
