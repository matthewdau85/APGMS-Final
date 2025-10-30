import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/app";

let app: FastifyInstance;

describe("security headers", () => {
  before(async () => {
    app = await buildServer();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("applies helmet headers on public endpoints", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);

    const csp = response.headers["content-security-policy"];
    assert.ok(csp, "expected CSP header");
    assert.ok(
      csp.includes("default-src 'self'"),
      `expected default-src directive, got: ${csp}`,
    );
    assert.ok(
      csp.includes(
        "script-src 'self' 'sha256-+Ul8C6HpBvEV0hgFekKPKiEh0Ug3SIn50SjA+iyTNHo='",
      ),
      `expected script-src directive, got: ${csp}`,
    );
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
  });

  it("rejects disallowed origins with 403", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://evil.example",
      },
    });

    assert.equal(response.statusCode, 403);
  });

  it("allows configured origins and returns ACAO header", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
      },
    });

    assert.notEqual(response.statusCode, 403);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "http://localhost:5173",
    );
  });
});
