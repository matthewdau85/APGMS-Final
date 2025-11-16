import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

export type AccountMap = {
  paygw: string;
  gst: string;
  paygi: string;
  clearing: string;
};

export async function generateDemoReconciliationArtifact(
  prisma: PrismaClient,
  orgId: string,
  accounts: AccountMap,
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const balances = await Promise.all([
    fetchAccountBalance(prisma, orgId, accounts.paygw),
    fetchAccountBalance(prisma, orgId, accounts.gst),
    fetchAccountBalance(prisma, orgId, accounts.paygi),
    fetchAccountBalance(prisma, orgId, accounts.clearing),
  ]);

  const inflows = await Promise.all([
    fetchInflow(prisma, orgId, accounts.paygw, cutoff),
    fetchInflow(prisma, orgId, accounts.gst, cutoff),
    fetchInflow(prisma, orgId, accounts.paygi, cutoff),
  ]);

  const summary = {
    generatedAt: now.toISOString(),
    orgId,
    balances: {
      paygwCents: balances[0].toString(),
      gstCents: balances[1].toString(),
      paygiCents: balances[2].toString(),
      clearingCents: balances[3].toString(),
    },
    inflowsLast24h: {
      paygwCents: inflows[0].toString(),
      gstCents: inflows[1].toString(),
      paygiCents: inflows[2].toString(),
    },
  };

  const sha256 = hashObject(summary);
  const created = await prisma.evidenceArtifact.create({
    data: {
      orgId,
      kind: "demo-reconciliation",
      wormUri: "internal:demo/pending",
      sha256,
      payload: summary,
    },
  });
  const artifact = await prisma.evidenceArtifact.update({
    where: { id: created.id },
    data: { wormUri: `internal:demo/${created.id}` },
  });
  return { artifactId: artifact.id, sha256, summary };
}

export async function generateDemoStpReport(
  prisma: PrismaClient,
  orgId: string,
  paygwAccountId: string,
  outputPath?: string,
) {
  const journals = await prisma.journal.findMany({
    where: { orgId, type: "PAYROLL_HOLD" },
    orderBy: { occurredAt: "asc" },
    include: { postings: true },
  });

  const rows = journals.map((journal, index) => {
    const paygwPosting = journal.postings.find(
      (posting) => posting.accountId === paygwAccountId && posting.amountCents > 0n,
    );
    return {
      payrollId: journal.eventId,
      employeeId: `demo-employee-${(index % 5) + 1}`,
      paygwCents: paygwPosting ? paygwPosting.amountCents.toString() : "0",
      processedAt: journal.occurredAt.toISOString(),
    };
  });

  const payload = { generatedAt: new Date().toISOString(), rows };
  const filePath = outputPath ?? path.join(process.cwd(), "artifacts", `demo-stp-${Date.now()}.json`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

export async function fetchAccountBalance(
  prisma: PrismaClient,
  orgId: string,
  accountId: string,
): Promise<bigint> {
  const aggregate = await prisma.posting.aggregate({
    where: { orgId, accountId },
    _sum: { amountCents: true },
  });
  return aggregate._sum.amountCents ?? 0n;
}

export async function fetchInflow(
  prisma: PrismaClient,
  orgId: string,
  accountId: string,
  cutoff: Date,
): Promise<bigint> {
  const aggregate = await prisma.posting.aggregate({
    where: { orgId, accountId, amountCents: { gt: 0 }, journal: { occurredAt: { gte: cutoff } } },
    _sum: { amountCents: true },
  });
  return aggregate._sum.amountCents ?? 0n;
}

export function hashObject(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
