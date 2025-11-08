import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import Fastify, { type FastifyInstance } from "fastify";

import { config } from "../src/config";
import { prisma } from "../src/db";
import * as regulatorSession from "../src/lib/regulator-session";
import * as audit from "../src/lib/audit";
import { registerRegulatorAuthRoutes } from "../src/routes/regulator-auth";

describe("POST /regulator/login", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerRegulatorAuthRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    mock.restoreAll();
  });

  it("issues a token for a valid access code", async () => {
    const expectedOrgId = config.regulator.accessCodeOrgMap[config.regulator.accessCode];
    const issuedAt = new Date("2024-01-01T00:00:00.000Z");
    const expiresAt = new Date("2024-01-01T01:00:00.000Z");

    const findUniqueMock = mock.method(prisma.org, "findUnique", async (args: any) => {
      assert.equal(args?.where?.id, expectedOrgId);
      return { id: expectedOrgId };
    });

    const createSessionMock = mock.method(
      regulatorSession,
      "createRegulatorSession",
      async (orgId: string, ttlMinutes: number) => {
        assert.equal(orgId, expectedOrgId);
        assert.equal(ttlMinutes, config.regulator.sessionTtlMinutes);
        return {
          session: { id: "session-123", issuedAt, expiresAt },
          sessionToken: "session-token",
        };
      },
    );

    const auditMock = mock.method(audit, "recordAuditLog", async (entry: any) => {
      assert.equal(entry.orgId, expectedOrgId);
      assert.equal(entry.action, "regulator.login");
    });

    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: ` ${config.regulator.accessCode} ` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      token: string;
      orgId: string;
      session: { id: string; issuedAt: string; expiresAt: string; sessionToken: string };
    };

    assert.equal(body.orgId, expectedOrgId);
    assert.equal(body.session.id, "session-123");
    assert.equal(body.session.issuedAt, issuedAt.toISOString());
    assert.equal(body.session.expiresAt, expiresAt.toISOString());
    assert.equal(body.session.sessionToken, "session-token");
    assert.equal(typeof body.token, "string");
    assert.ok(body.token.length > 0);

    assert.equal(findUniqueMock.mock.calls.length, 1);
    assert.equal(createSessionMock.mock.calls.length, 1);
    assert.equal(auditMock.mock.calls.length, 1);
  });

  it("rejects unknown access codes", async () => {
    const findUniqueMock = mock.method(prisma.org, "findUnique", async () => {
      throw new Error("should not query database for invalid access codes");
    });
    const createSessionMock = mock.method(
      regulatorSession,
      "createRegulatorSession",
      async () => {
        throw new Error("should not create sessions for invalid access codes");
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: "nope" },
    });

    assert.equal(response.statusCode, 401);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, "access_denied");
    assert.equal(findUniqueMock.mock.calls.length, 0);
    assert.equal(createSessionMock.mock.calls.length, 0);
  });

  it("rejects payloads with unexpected properties", async () => {
    const findUniqueMock = mock.method(prisma.org, "findUnique", async () => {
      throw new Error("should not query database for invalid payloads");
    });

    const response = await app.inject({
      method: "POST",
      url: "/regulator/login",
      payload: { accessCode: config.regulator.accessCode, orgId: "evil" },
    });

    assert.equal(response.statusCode, 400);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, "invalid_body");
    assert.equal(findUniqueMock.mock.calls.length, 0);
  });
});
