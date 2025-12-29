import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/app.js";

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
    assert.equal(
      response.headers["strict-transport-security"],
      "max-age=15552000; includeSubDomains; preload",
    );
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

  it("allows Idempotency-Key preflight on /bank-lines and exposes replay header", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/bank-lines",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "Idempotency-Key, Content-Type",
      },
    });

    assert.notEqual(response.statusCode, 403);
    const allowed = String(response.headers["access-control-allow-headers"] ?? "");
    assert.ok(
      allowed.toLowerCase().includes("idempotency-key"),
      `expected ACAH to include Idempotency-Key, got ${allowed}`,
    );
    const expose = String(response.headers["access-control-expose-headers"] ?? "");
    assert.ok(
      expose.toLowerCase().includes("idempotent-replay"),
      `expected ACEH to include Idempotent-Replay, got ${expose}`,
    );
  });
});
