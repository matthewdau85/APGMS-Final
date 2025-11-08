import { describe, expect, it, jest } from "@jest/globals";

import {
  assertOrgAccess,
  assertRoleForBankLines,
  redactBankLine,
} from "../src/utils/orgScope.js";

const createReply = () => {
  const reply = {
    statusCode: undefined as number | undefined,
    payload: undefined as unknown,
    code: jest.fn(function code(this: any, status: number) {
      this.statusCode = status;
      return this;
    }),
    send: jest.fn(function send(this: any, payload: unknown) {
      this.payload = payload;
      return this;
    }),
  };
  return reply;
};

describe("redactBankLine", () => {
  it("preserves safe fields and strips sensitive data", () => {
    const input = {
      id: "line-1",
      orgId: "org-1",
      accountRef: "acc-123",
      amountCents: 12345,
      currency: "AUD",
      createdAt: new Date("2025-03-03T00:00:00Z"),
      bankAccountNumber: "123456789",
      taxFileNumber: "123-456-789",
    };

    const result = redactBankLine(input);

    expect(result).toEqual({
      id: "line-1",
      orgId: "org-1",
      accountRef: "acc-123",
      amountCents: 12345,
      currency: "AUD",
      createdAt: new Date("2025-03-03T00:00:00Z"),
    });

    expect(result).not.toHaveProperty("bankAccountNumber");
    expect(result).not.toHaveProperty("taxFileNumber");
  });

  it("returns falsy values as-is", () => {
    expect(redactBankLine(null)).toBeNull();
    expect(redactBankLine(undefined as unknown as Record<string, unknown>)).toBeUndefined();
  });
});

describe("assertOrgAccess", () => {
  it("rejects unauthenticated requests", () => {
    const reply = createReply();
    const ok = assertOrgAccess({} as any, reply as any, "org-1");

    expect(ok).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "unauthenticated" });
  });

  it("rejects mismatched organizations", () => {
    const reply = createReply();
    const request = { user: { orgId: "org-2" } };

    const ok = assertOrgAccess(request as any, reply as any, "org-1");

    expect(ok).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: "forbidden_wrong_org" });
  });

  it("returns true when the actor belongs to the org", () => {
    const reply = createReply();
    const request = { user: { orgId: "org-1" } };

    const ok = assertOrgAccess(request as any, reply as any, "org-1");

    expect(ok).toBe(true);
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});

describe("assertRoleForBankLines", () => {
  it("rejects unauthenticated requests", () => {
    const reply = createReply();
    const ok = assertRoleForBankLines({} as any, reply as any);

    expect(ok).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "unauthenticated" });
  });

  it("rejects unsupported roles", () => {
    const reply = createReply();
    const request = { user: { role: "viewer" } };

    const ok = assertRoleForBankLines(request as any, reply as any);

    expect(ok).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: "forbidden_role" });
  });

  it("allows permitted roles", () => {
    const reply = createReply();
    const request = { user: { role: "admin" } };

    const ok = assertRoleForBankLines(request as any, reply as any);

    expect(ok).toBe(true);
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
