import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { Decimal } from "@prisma/client/runtime/library.js";

import { generateDesignatedAccountReconciliationArtifact } from "@apgms/domain-policy";
import { createBankingProvider } from "../../../providers/banking/index.js";
import { createInMemoryPrisma } from "./helpers/in-memory-prisma.js";

const PROVIDERS = ["mock", "nab", "anz", "cba", "westpac"] as const;

const originalFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
});

after(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
  }
});

for (const providerId of PROVIDERS) {
  test(`funds reconciliation succeeds for ${providerId}`, async () => {
    const { prisma, state } = createInMemoryPrisma();

    state.designatedAccounts.push({
      id: "acct-gst",
      orgId: "org-1",
      type: "GST",
      balance: new Decimal(0),
      updatedAt: new Date(),
    });

    const provider = createBankingProvider(providerId);
    const context = {
      prisma,
      orgId: "org-1",
      actorId: `actor-${providerId}`,
      auditLogger: async (entry: any) => {
        await prisma.auditLog.create({ data: entry });
      },
    };

    const captureAmount = 2500;

    const transfer = await provider.creditDesignatedAccount(context, {
      accountId: "acct-gst",
      amount: captureAmount,
      source: "GST_CAPTURE",
    });

    assert.equal(transfer.accountId, "acct-gst");
    assert.equal(transfer.newBalance, captureAmount);
    assert.equal(state.designatedTransfers.length, 1);

    const { summary, artifactId } =
      await generateDesignatedAccountReconciliationArtifact(
        {
          prisma,
          auditLogger: async (entry: any) => {
            await prisma.auditLog.create({ data: entry });
          },
        },
        "org-1",
        "system",
      );

    assert.ok(artifactId.length > 0);
    assert.equal(summary.totals.gst, captureAmount);
    assert.equal(state.evidenceArtifacts.length, 1);
    assert.equal(
      state.auditLogs.some(
        (entry) => entry.action === "designatedAccount.reconciliation",
      ),
      true,
    );
  });
}
