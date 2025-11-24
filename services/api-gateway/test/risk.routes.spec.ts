import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";

import Fastify, { type FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";

process.env.AUTH_DEV_SECRET ??= "local-dev-secret";
process.env.AUTH_ISSUER ??= "urn:test:issuer";
process.env.AUTH_AUDIENCE ??= "urn:test:aud";
process.env.AUTH_JWKS ??=
  JSON.stringify({ keys: [{ kid: "local-dev", kty: "oct", alg: "HS256", k: Buffer.from(process.env.AUTH_DEV_SECRET!, "utf8").toString("base64") }] });
process.env.MOCK_PRISMA_CLIENT ??= "true";
process.env.DATABASE_URL ??= "file:mock.db";

const SECRET = process.env.AUTH_DEV_SECRET!;
const ISSUER = process.env.AUTH_ISSUER!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;

let detectRiskMock: ReturnType<typeof mock.fn>;

const { resetRiskOperations, setRiskOperations } = await import("../src/operations/risk.js");
const { authGuard } = await import("../src/auth.js");
const { registerRiskRoutes } = await import("../src/routes/risk.js");

function signToken({ orgId = "org-1" }: { orgId?: string } = {}) {
  return jwt.sign({ sub: "user-1", orgId, role: "admin", mfaEnabled: true }, SECRET, {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: "5m",
    header: { kid: "local-dev" },
  });
}

describe("risk routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    app.addHook("onRequest", authGuard);
    await registerRiskRoutes(app);
    await app.ready();
  });

  beforeEach(() => {
    detectRiskMock = mock.fn(async (orgId: string, taxType: string) => ({
      record: { id: "risk-1", orgId, taxType, severity: "low", score: 0.1, description: "ok" },
      snapshot: { anomaly: { score: 0.1 } },
    }));
    setRiskOperations({ detectRisk: detectRiskMock, listRiskEvents: async () => [] });
  });

  after(async () => {
    resetRiskOperations();
    await app.close();
  });

  it("accepts valid tax types", async () => {
    const token = signToken({ orgId: "org-valid" });
    const response = await app.inject({
      method: "GET",
      url: "/monitor/risk?taxType=GST",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(detectRiskMock.mock.calls.length, 1);
    assert.deepEqual(detectRiskMock.mock.calls[0].arguments, ["org-valid", "GST"]);
    const body = response.json() as { risk: { taxType: string } };
    assert.equal(body.risk.taxType, "GST");
  });

  it("rejects invalid tax types", async () => {
    const token = signToken();
    const response = await app.inject({
      method: "GET",
      url: "/monitor/risk?taxType=INVALID",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(detectRiskMock.mock.calls.length, 0);
    const body = response.json() as { error: { code: string; details: { fieldErrors: Record<string, string[]> } } };
    assert.equal(body.error.code, "invalid_query");
    assert.ok(body.error.details.fieldErrors.taxType?.length);
  });
});
