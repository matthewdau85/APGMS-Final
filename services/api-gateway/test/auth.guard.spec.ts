import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import Fastify from "fastify";
import jwt from "jsonwebtoken";

import { authGuard } from "../src/auth";

const SECRET = process.env.AUTH_DEV_SECRET!;
const ISSUER = process.env.AUTH_ISSUER!;
const AUDIENCE = process.env.AUTH_AUDIENCE!;

function signToken(overrides: Partial<jwt.JwtPayload> = {}, options: jwt.SignOptions = {}) {
  const payload: jwt.JwtPayload = {
    sub: "user-1",
    orgId: "dev-org",
    role: "admin",
    mfaEnabled: true,
    ...overrides,
  };

  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: "5m",
    ...options,
  });
}

describe("authGuard enforcement", () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    app = Fastify();
    app.addHook("onRequest", authGuard);
    app.get("/secure", async (request) => ({
      user: request.user,
    }));
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("allows valid tokens and scopes user context", async () => {
    const token = signToken();
    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { user: any };
    assert.equal(body.user.sub, "user-1");
    assert.equal(body.user.orgId, "dev-org");
    assert.equal(body.user.role, "admin");
    assert.equal(body.user.mfaEnabled, true);
    assert.equal(body.user.regulator ?? false, false);
  });

  it("rejects tokens with wrong audience", async () => {
    const token = signToken({}, { audience: "urn:other" });
    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 401);
  });

  it("rejects tokens with wrong issuer", async () => {
    const token = signToken({}, { issuer: "urn:wrong" });
    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 401);
  });

  it("rejects expired tokens", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = jwt.sign(
      {
        sub: "user-1",
        orgId: "dev-org",
        role: "admin",
        mfaEnabled: true,
        exp: past,
      },
      SECRET,
      {
        algorithm: "HS256",
        audience: AUDIENCE,
        issuer: ISSUER,
        noTimestamp: true,
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 401);
  });

  it("rejects tokens not yet valid", async () => {
    const token = jwt.sign(
      {
        sub: "user-1",
        orgId: "dev-org",
        role: "admin",
        mfaEnabled: true,
      },
      SECRET,
      {
        algorithm: "HS256",
        audience: AUDIENCE,
        issuer: ISSUER,
        notBefore: 120,
        expiresIn: "5m",
      },
    );
    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 401);
  });

  it("rejects tokens without org scope", async () => {
    const token = jwt.sign(
      {
        sub: "user-1",
        role: "admin",
        mfaEnabled: true,
      },
      SECRET,
      {
        algorithm: "HS256",
        audience: AUDIENCE,
        issuer: ISSUER,
        expiresIn: "5m",
      },
    );
    const response = await app.inject({
      method: "GET",
      url: "/secure",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 401);
  });
});
