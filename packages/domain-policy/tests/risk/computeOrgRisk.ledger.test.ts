// packages/domain-policy/tests/risk/computeOrgRisk.ledger.test.ts

import { prisma } from "@apgms/shared/db.js";
import { appendLedgerEntry } from "../../src/ledger/tax-ledger";
import { computeOrgRisk } from "../../src/risk/anomaly";

describe("computeOrgRisk – ledger integrity", () => {
  const orgId = "org-risk-ledger-test";
  const period = "2025-Q1";

  beforeEach(async () => {
    // Start each test with a clean ledger for this org/period
    await prisma.taxLedgerEntry.deleteMany({ where: { orgId, period } });
  });

  afterAll(async () => {
    // Clean up once at the end
    await prisma.taxLedgerEntry.deleteMany({ where: { orgId, period } });
  });

  it("includes ledgerIntegrity.ok=true when chain is intact", async () => {
    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "CREDIT",
      amountCents: 1_000,
      description: "Initial PAYGW credit for risk test",
    });

    const snapshot = await computeOrgRisk(orgId, period);

    expect(snapshot.ledgerIntegrity).toBeDefined();
    expect(snapshot.ledgerIntegrity!.ok).toBe(true);
  });

  it("flags ledgerIntegrity.ok=false and does not treat risk as LOW when chain is broken", async () => {
    // 1. Build a valid mini-chain
    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "CREDIT",
      amountCents: 2_000,
      description: "First entry for ledger-risk test",
    });

    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "CREDIT",
      amountCents: 3_000,
      description: "Second entry for ledger-risk test",
    });

    // 2. Tamper the second entry's hashPrev to break the chain
    const entries = await prisma.taxLedgerEntry.findMany({
      where: { orgId, period },
      orderBy: { createdAt: "asc" },
    });

    expect(entries.length).toBe(2);

    const second = entries[1];

    await prisma.taxLedgerEntry.update({
      where: { id: second.id },
      data: {
        hashPrev: "deadbeef-not-a-real-hash",
      },
    });

    // 3. Compute risk and assert the integrity + risk level
    const snapshot = await computeOrgRisk(orgId, period);

    expect(snapshot.ledgerIntegrity).toBeDefined();
    expect(snapshot.ledgerIntegrity!.ok).toBe(false);
    expect(snapshot.ledgerIntegrity!.firstInvalidIndex).toBe(1);
    expect(snapshot.ledgerIntegrity!.reason).toContain("hashPrev mismatch");

    // Overall risk level should not be LOW when the chain is broken.
    // With your current placeholder logic this will likely be "MEDIUM",
    // but we allow "HIGH" as well if metrics change later.
    expect(["MEDIUM", "HIGH"]).toContain(snapshot.overallLevel);
  });
});
