import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/app";
import { prisma } from "../src/db";
import { promRegister } from "../src/observability/metrics";

describe("POST /regulator/login", () => {
  let app: FastifyInstance;

  const originalOrgFindUnique = prisma.org.findUnique.bind(prisma.org);
  const originalRegulatorCreate = prisma.regulatorSession.create.bind(
    prisma.regulatorSession,
  );
  const originalAuditFindFirst = prisma.auditLog.findFirst.bind(prisma.auditLog);
  const originalAuditCreate = prisma.auditLog.create.bind(prisma.auditLog);

  before(async () => {
    app = await buildServer();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    promRegister.resetMetrics();

    prisma.org.findUnique = (async () => ({ id: "org-123" })) as typeof prisma.org.findUnique;
    prisma.regulatorSession.create = (async () => ({
      id: "session-1",
      orgId: "org-123",
      tokenHash: "hash",
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastUsedAt: new Date(),
      revokedAt: null,
    })) as typeof prisma.regulatorSession.create;
    prisma.auditLog.findFirst = (async () => null) as typeof prisma.auditLog.findFirst;
    prisma.auditLog.create = (async () => ({})) as typeof prisma.auditLog.create;
  });

  afterEach(() => {
    prisma.org.findUnique = originalOrgFindUnique as typeof prisma.org.findUnique;
    prisma.regulatorSession.create =
      originalRegulatorCreate as typeof prisma.regulatorSession.create;
    prisma.auditLog.findFirst = originalAuditFindFirst as typeof prisma.auditLog.findFirst;
    prisma.auditLog.create = originalAuditCreate as typeof prisma.auditLog.create;
  });

  it("rejects payloads missing required fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "regulator-dev-code" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error?.code, "invalid_body");
  });

  it("records metrics when access code is invalid", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "wrong-code", orgId: "org-123" },
    });

    assert.equal(response.statusCode, 401);

    const metrics = await promRegister.getMetricsAsJSON();
    const securityMetric = metrics.find(
      (metric) => metric.name === "apgms_security_events_total",
    );
    assert.ok(securityMetric, "expected security events counter to be registered");
    const invalidCodeValue = securityMetric.values.find(
      (entry) => entry.labels?.event === "regulator.login.invalid_code",
    );
    assert.equal(invalidCodeValue?.value, 1);
  });

  it("requires org to exist", async () => {
    prisma.org.findUnique = (async () => null) as typeof prisma.org.findUnique;

    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "regulator-dev-code", orgId: "missing-org" },
    });

    assert.equal(response.statusCode, 404);
    const metrics = await promRegister.getMetricsAsJSON();
    const securityMetric = metrics.find(
      (metric) => metric.name === "apgms_security_events_total",
    );
    const unknownOrg = securityMetric?.values.find(
      (entry) => entry.labels?.event === "regulator.login.unknown_org",
    );
    assert.equal(unknownOrg?.value, 1);
  });

  it("returns a session token for valid requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "regulator-dev-code", orgId: "org-123" },
    });

    assert.equal(response.statusCode, 200);
    const json = response.json();
    assert.ok(typeof json.token === "string" && json.token.length > 0);
    assert.ok(json.session?.id);
    assert.ok(json.session?.sessionToken);
  });
});
