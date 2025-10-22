import type { Role } from "../src/plugins/auth";
import { createApp } from "../src/app";

const buildPrismaStub = (orgId: string) => {
  const line = {
    id: "line-1",
    orgId,
    date: new Date("2024-01-01T00:00:00.000Z"),
    amount: 0,
    payee: "example",
    desc: "example",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    idempotencyKey: null as string | null,
  };

  const txClient = {
    org: { update: async () => ({}) },
    user: { deleteMany: async () => ({}) },
    bankLine: { deleteMany: async () => ({}) },
    orgTombstone: { create: async () => ({}) },
  };

  return {
    $queryRaw: async () => 1,
    $transaction: async (fn: (tx: typeof txClient) => unknown | Promise<unknown>) =>
      await Promise.resolve(fn(txClient)),
    org: { findUnique: async () => null },
    orgTombstone: { create: async () => ({}) },
    user: { findMany: async () => [] },
    bankLine: {
      findMany: async () => [],
      upsert: async () => line,
      create: async () => line,
      deleteMany: async () => ({}),
    },
  } as const;
};

type TokenPayload = { sub: string; orgId: string; roles: Role[] };

interface BuildAppOptions {
  tokenRole?: Role;
  tokenOrgId?: string;
  tokenSub?: string;
  tokens?: Array<{ token: string; payload: TokenPayload }>;
}

const buildDefaultTokens = (orgId: string, sub: string): Array<{ token: string; payload: TokenPayload }> => {
  const roles: Role[] = ["admin", "manager", "analyst", "viewer"];
  return roles.map((role) => ({
    token: `TEST_${role.toUpperCase()}`,
    payload: { sub: `${sub}-${role}`, orgId, roles: [role] },
  }));
};

export async function buildApp(options: BuildAppOptions = {}) {
  const orgId = options.tokenOrgId ?? "org-123";
  const sub = options.tokenSub ?? "user-123";

  const tokenEntries = new Map<string, TokenPayload>();

  for (const entry of buildDefaultTokens(orgId, sub)) {
    tokenEntries.set(entry.token, entry.payload);
  }

  if (options.tokenRole) {
    tokenEntries.set(`TEST_${options.tokenRole.toUpperCase()}`, {
      sub,
      orgId,
      roles: [options.tokenRole],
    });
  }

  for (const entry of options.tokens ?? []) {
    tokenEntries.set(entry.token, entry.payload);
  }

  const verify = async (token: string) => {
    const payload = tokenEntries.get(token);
    if (!payload) {
      throw new Error("invalid token");
    }
    return { payload };
  };

  const app = await createApp({
    prisma: buildPrismaStub(orgId) as any,
    auth: {
      jwksUrl: "http://localhost/.well-known/jwks.json",
      issuer: "test-issuer",
      audience: "test-audience",
      verify,
    },
  });

  await app.ready();
  return app;
}
