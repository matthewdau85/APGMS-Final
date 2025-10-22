import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";
import { hashPassword } from "@apgms/shared";

type UserRecord = {
  id: string;
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
};

test("synthetic probe exercises login and data retrieval", async (t) => {
  process.env.JWT_SECRET = "synthetic-secret";
  process.env.ADMIN_EMAIL_ALLOWLIST = "";

  const users: UserRecord[] = [
    {
      id: "user-1",
      email: "founder@example.com",
      password: await hashPassword("Supersafe123"),
      orgId: "org-1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    },
  ];
  const bankLines: BankLineRecord[] = [
    {
      id: "line-1",
      orgId: "org-1",
      date: new Date("2024-03-01T00:00:00.000Z"),
      amount: 1250.45,
      payee: "Acme",
      desc: "Fit-out",
      createdAt: new Date("2024-03-02T00:00:00.000Z"),
    },
  ];

  const prismaStub: any = {
    user: {
      findUnique: async ({ where, select }: any) => {
        const record = users.find((user) => user.email === where?.email);
        if (!record) return null;
        if (!select) {
          return { ...record, org: { deletedAt: null } };
        }
        const result: Record<string, unknown> = {};
        if (select.id) result.id = record.id;
        if (select.email) result.email = record.email;
        if (select.password) result.password = record.password;
        if (select.orgId) result.orgId = record.orgId;
        if (select.createdAt) result.createdAt = record.createdAt;
        if (select.org) result.org = { deletedAt: null };
        return result;
      },
      findMany: async ({ where }: any) => {
        return users
          .filter((user) => !where?.orgId || user.orgId === where.orgId)
          .map((user) => ({ id: user.id, email: user.email, createdAt: user.createdAt }));
      },
    },
    bankLine: {
      findMany: async ({ where }: any) => {
        return bankLines.filter((line) => line.orgId === where?.orgId);
      },
      create: async ({ data }: any) => {
        bankLines.push({
          id: `line-${bankLines.length + 1}`,
          orgId: data.orgId,
          date: data.date,
          amount: Number(data.amount),
          payee: data.payee,
          desc: data.desc,
          createdAt: new Date(),
        });
        return bankLines[bankLines.length - 1];
      },
    },
    $transaction: async (cb: any) => cb(prismaStub),
    $queryRaw: async () => 1,
  };

  const app = await createApp({ prisma: prismaStub as PrismaClient });
  await app.ready();
  t.after(async () => {
    await app.close();
  });

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "founder@example.com", password: "Supersafe123" },
  });
  assert.equal(login.statusCode, 200);
  const { token, expiresIn } = login.json() as { token: string; expiresIn: number };
  assert.ok(token);
  assert.equal(expiresIn, 15 * 60);

  const usersRes = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(usersRes.statusCode, 200);
  const usersPayload = usersRes.json() as any;
  assert.equal(usersPayload.users.length, 1);

  const linesRes = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(linesRes.statusCode, 200);
  const linesPayload = linesRes.json() as any;
  assert.equal(linesPayload.lines.length, 1);

  const createRes = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      date: new Date().toISOString(),
      amount: "42.10",
      payee: "CloudHost",
      desc: "Usage",
    },
  });
  assert.equal(createRes.statusCode, 201);
  const createBody = createRes.json() as any;
  assert.equal(createBody.payee, "CloudHost");
  assert.equal(bankLines.length, 2);

});
