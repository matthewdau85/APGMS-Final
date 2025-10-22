import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthTokenPayload } from "../types/auth";

type SignOptions = {
  issuer?: string;
  expiresIn?: number | string;
};

type VerifyOptions = {
  issuer?: string;
};

export type JwtPluginOptions = {
  secret: string;
  sign?: SignOptions;
  verify?: VerifyOptions;
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function toSeconds(input: number | string | undefined, fallback: number): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const match = input.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = Number(match[1]);
      const unit = match[2];
      switch (unit) {
        case "s":
          return value;
        case "m":
          return value * 60;
        case "h":
          return value * 3600;
        case "d":
          return value * 86400;
        default:
          break;
      }
    }
  }
  return fallback;
}

function signJwt(payload: AuthTokenPayload, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = base64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${signature}`;
}

function verifyJwt(token: string, secret: string): AuthTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token_format");
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = base64url(createHmac("sha256", secret).update(data).digest());
  if (signature !== expectedSignature) {
    throw new Error("invalid_signature");
  }
  const payloadJson = Buffer.from(encodedPayload, "base64").toString("utf8");
  const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
  return normalizePayload(parsed);
}

function normalizePayload(candidate: Record<string, unknown>): AuthTokenPayload {
  const sub = typeof candidate.sub === "string" ? candidate.sub : undefined;
  const orgId = typeof candidate.orgId === "string" ? candidate.orgId : undefined;
  const email = typeof candidate.email === "string" ? candidate.email : undefined;
  const role = candidate.role === "admin" ? "admin" : candidate.role === "user" ? "user" : undefined;
  if (!sub || !orgId || !email || !role) {
    throw new Error("invalid_payload");
  }
  const id = typeof candidate.id === "string" ? candidate.id : sub;
  const payload: AuthTokenPayload = {
    id,
    sub,
    orgId,
    email,
    role,
  };
  if (candidate.aud !== undefined) {
    payload.aud = candidate.aud as string | string[];
  }
  if (typeof candidate.iss === "string") {
    payload.iss = candidate.iss;
  }
  if (typeof candidate.exp === "number") {
    payload.exp = candidate.exp;
  }
  if (typeof candidate.iat === "number") {
    payload.iat = candidate.iat;
  }
  return payload;
}

export async function registerJwtStub(app: FastifyInstance, options: JwtPluginOptions): Promise<void> {
  const secret = options.secret;
  const defaultIssuer = options.sign?.issuer ?? "apgms-stub";
  const defaultExpirySeconds = toSeconds(options.sign?.expiresIn, 900);
  const verifyIssuer = options.verify?.issuer ?? defaultIssuer;

  app.decorateReply(
    "jwtSign",
    async function jwtSign(
      payload: AuthTokenPayload,
      signOpts?: { audience?: string; issuer?: string; expiresIn?: number | string }
    ) {
      const now = Math.floor(Date.now() / 1000);
      const issuer = signOpts?.issuer ?? defaultIssuer;
      const expirySeconds = toSeconds(signOpts?.expiresIn, defaultExpirySeconds);
      const fullPayload: AuthTokenPayload = {
        ...payload,
        iss: issuer,
        iat: now,
        exp: now + expirySeconds,
      };
      if (signOpts?.audience) {
        fullPayload.aud = signOpts.audience;
      }
      return signJwt(fullPayload, secret);
    }
  );

  app.decorateRequest("jwtVerify", async function jwtVerify(this: any) {
    const header = this.headers?.authorization ?? this.headers?.Authorization;
    if (!header || typeof header !== "string") {
      throw new Error("missing_authorization_header");
    }
    const match = header.match(/^Bearer (.+)$/i);
    if (!match) {
      throw new Error("invalid_authorization_header");
    }
    const token = match[1];
    const payload = verifyJwt(token, secret);
    const exp = payload.exp;
    if (typeof exp === "number" && Math.floor(Date.now() / 1000) >= exp) {
      throw new Error("token_expired");
    }
    if (verifyIssuer && payload.iss !== verifyIssuer) {
      throw new Error("invalid_issuer");
    }
    this.user = payload;
    return payload;
  });

  app.decorate("jwt", {
    sign: async (
      payload: AuthTokenPayload,
      signOpts?: { audience?: string; issuer?: string; expiresIn?: number | string }
    ) => {
      const now = Math.floor(Date.now() / 1000);
      const issuer = signOpts?.issuer ?? defaultIssuer;
      const expirySeconds = toSeconds(signOpts?.expiresIn, defaultExpirySeconds);
      const fullPayload: AuthTokenPayload = {
        ...payload,
        iss: issuer,
        iat: now,
        exp: now + expirySeconds,
      };
      if (signOpts?.audience) {
        fullPayload.aud = signOpts.audience;
      }
      return signJwt(fullPayload, secret);
    },
    verify: async (token: string) => {
      const payload = verifyJwt(token, secret);
      const exp = payload.exp;
      if (typeof exp === "number" && Math.floor(Date.now() / 1000) >= exp) {
        throw new Error("token_expired");
      }
      if (verifyIssuer && payload.iss !== verifyIssuer) {
        throw new Error("invalid_issuer");
      }
      return payload;
    },
  });

  app.log.info("registered fastify-jwt stub");
}
