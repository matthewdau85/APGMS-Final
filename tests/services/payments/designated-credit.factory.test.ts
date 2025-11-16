import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../../shared/src/errors.js";

import { createDesignatedAccountCreditService } from "../../../services/payments/src/factories/designated-credit.js";
import type { CreditDesignatedAccountPayload } from "../../../services/payments/src/types.js";

const createStubProvider = () => {
  const creditCalls: Array<{ context: unknown; input: unknown }> = [];
  return {
    id: "mock",
    capabilities: { maxReadTransactions: 0, maxWriteCents: 0 },
    creditDesignatedAccount: async (context: any, input: any) => {
      creditCalls.push({ context, input });
      return {
        accountId: input.accountId,
        newBalance: input.amount,
        transferId: "transfer-1",
        source: input.source,
      };
    },
    simulateDebitAttempt: async () => {
      throw new Error("not implemented");
    },
    get creditCalls() {
      return creditCalls;
    },
  };
};

test("createDesignatedAccountCreditService wires the provider context", async () => {
  const provider = createStubProvider();
  const prisma = { marker: true } as any;
  const service = createDesignatedAccountCreditService({ provider, prisma });

  const payload: CreditDesignatedAccountPayload = {
    orgId: "org-1",
    actorId: "actor-1",
    accountId: "acct-1",
    amount: 7500,
    source: "PAYROLL",
  };

  const result = await service(payload);

  assert.equal(result.accountId, payload.accountId);
  assert.equal(result.newBalance, payload.amount);
  assert.equal(provider.creditCalls.length, 1);
  const invocation = provider.creditCalls[0];
  assert.equal(invocation.context.orgId, payload.orgId);
  assert.equal(invocation.context.actorId, payload.actorId);
  assert.equal(invocation.context.prisma, prisma);
  assert.equal(invocation.input.accountId, payload.accountId);
});

test("createDesignatedAccountCreditService surfaces provider errors", async () => {
  const provider = createStubProvider();
  provider.creditDesignatedAccount = async () => {
    throw new AppError(409, "banking_write_cap_exceeded", "over limit");
  };
  const service = createDesignatedAccountCreditService({ provider, prisma: {} as any });

  await assert.rejects(
    () =>
      service({
        orgId: "org-2",
        actorId: "actor-2",
        accountId: "acct-2",
        amount: 1,
        source: "PAYROLL",
      }),
    (error: unknown) => {
      assert(error instanceof AppError);
      assert.equal(error.code, "banking_write_cap_exceeded");
      return true;
    },
  );
});
