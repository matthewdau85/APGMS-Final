import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../../shared/src/errors.js";
import { CbaBankingProvider } from "../../../providers/banking/cba.js";
import type { BankingProviderContext } from "../../../providers/banking/types.js";
import type { CbaBankingApiClient } from "../../../providers/banking/cba-client.js";

const createProvider = () => {
  const clientCalls: Array<Record<string, unknown>> = [];

  const client: Pick<CbaBankingApiClient, "createCredit"> = {
    async createCredit(payload) {
      clientCalls.push(payload);
    },
  };

  const provider = new CbaBankingProvider({
    client: client as CbaBankingApiClient,
    capabilities: {
      maxReadTransactions: 1_500,
      maxWriteCents: 1_000_000,
    },
  });

  return { provider, clientCalls };
};

const createContext = (): BankingProviderContext => ({
  prisma: {} as never,
  orgId: "org-test",
  actorId: "actor-test",
});

const createInput = (overrides: Partial<{ amount: number }>) => ({
  accountId: "acct-test",
  amount: 100,
  source: "PAYROLL_VALIDATION_TEST",
  ...overrides,
});

test("rejects non-positive amounts before calling the CBA API", async () => {
  const { provider, clientCalls } = createProvider();
  const context = createContext();

  await assert.rejects(
    () => provider.creditDesignatedAccount(context, createInput({ amount: 0 })),
    (error: unknown) => {
      assert(error instanceof AppError);
      assert.equal(error.code, "invalid_amount");
      return true;
    },
  );

  assert.equal(clientCalls.length, 0);
});

test("rejects transfers that would exceed the write cap before calling the CBA API", async () => {
  const { provider, clientCalls } = createProvider();
  const context = createContext();

  await assert.rejects(
    () =>
      provider.creditDesignatedAccount(
        context,
        createInput({ amount: 1_500_000 }),
      ),
    (error: unknown) => {
      assert(error instanceof AppError);
      assert.equal(error.code, "banking_write_cap_exceeded");
      return true;
    },
  );

  assert.equal(clientCalls.length, 0);
});
