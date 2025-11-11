import assert from "node:assert/strict";
import { test } from "node:test";

import { capturePayroll, capturePos, type ConnectorContext, type CaptureInput } from "../src/index.js";

const baseInput: CaptureInput = { orgId: "org-1", amount: 1200, actorId: "actor-1" };

function buildContext(accountType: string): ConnectorContext {
  return {
    prisma: {
      designatedAccount: {
        async findFirst({ where }: any) {
          if (where.type !== accountType) return null;
          return { id: `${accountType.toLowerCase()}-acct`, orgId: where.orgId, type: where.type };
        },
      },
    } as any,
  };
}

test("capturePayroll uses PAYROLL_CAPTURE source and generates artifact", async () => {
  const context = buildContext("PAYGW");
  const transferCalls: Array<any> = [];
  const artifactCalls: Array<any> = [];

  const result = await capturePayroll(
    context,
    baseInput,
    {
      applyTransfer: async (_ctx, payload) => {
        transferCalls.push(payload);
        return {
          accountId: payload.accountId,
          resource: "bank-line",
          newBalance: payload.amount,
          transferId: "transfer-payroll",
          source: payload.source,
        } as any;
      },
      generateArtifact: async (_ctx, orgId, actorId) => {
        artifactCalls.push({ orgId, actorId });
        return {
          summary: { generatedAt: new Date().toISOString(), totals: { paygw: 1, gst: 0 }, movementsLast24h: [] },
          artifactId: "payroll-artifact",
          sha256: "deadbeef",
        } as any;
      },
    },
  );

  assert.equal(transferCalls.length, 1);
  assert.equal(transferCalls[0].source, "PAYROLL_CAPTURE");
  assert.equal(result.artifact.artifactId, "payroll-artifact");
  assert.equal(artifactCalls[0].actorId, baseInput.actorId);
});

test("capturePos uses GST_CAPTURE source and returns summary", async () => {
  const context = buildContext("GST");
  const result = await capturePos(
    context,
    { ...baseInput, amount: 2000 },
    {
      applyTransfer: async (_ctx, payload) => ({
        accountId: payload.accountId,
        newBalance: payload.amount,
        resource: "pos",
        transferId: "transfer-pos",
        source: payload.source,
      } as any),
      generateArtifact: async () => ({
        summary: { generatedAt: new Date().toISOString(), totals: { paygw: 0, gst: 1 }, movementsLast24h: [] },
        artifactId: "pos-artifact",
        sha256: "cafebabe",
      } as any),
    },
  );

  assert.equal(result.transfer.source, "GST_CAPTURE");
  assert.equal(result.artifact.sha256, "cafebabe");
});

test("capture fails when target account missing", async () => {
  await assert.rejects(
    () =>
      capturePayroll(
        { prisma: { designatedAccount: { async findFirst() { return null; } } } as any },
        baseInput,
        {
          applyTransfer: async () => ({} as any),
          generateArtifact: async () => ({} as any),
        },
      ),
    /designated_account_missing/,
  );
});
