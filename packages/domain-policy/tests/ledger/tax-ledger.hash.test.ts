// packages/domain-policy/tests/ledger/tax-ledger.hash.test.ts

import { prisma } from "@apgms/shared/db.js";
import {
  appendLedgerEntry,
  verifyLedgerChain,
} from "../../src/ledger/tax-ledger";

describe("TaxLedger hash-chain integrity", () => {
  const orgId = "org-ledger-hash-test";
  const period = "2025-Q1";

  // Clean slate before and after
  beforeAll(async () => {
    await prisma.taxLedgerEntry.deleteMany({
      where: { orgId, period },
    });
  });

  afterAll(async () => {
    await prisma.taxLedgerEntry.deleteMany({
      where: { orgId, period },
    });
  });

  it("returns ok=true for a normal, untampered chain", async () => {
    // Arrange: build a small chain of entries
    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "CREDIT",
      amountCents: 10_000,
      description: "Initial PAYGW credit",
    });

    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "DEBIT",
      amountCents: 2_500,
      description: "Partial reversal / adjustment",
    });

    await appendLedgerEntry({
      orgId,
      period,
      category: "GST",
      direction: "CREDIT",
      amountCents: 5_000,
      description: "Initial GST credit",
    });

    const result = await verifyLedgerChain(orgId, period);

    expect(result.ok).toBe(true);
    expect(result.firstInvalidIndex).toBeUndefined();
    expect(result.reason).toBeUndefined();
  });

  it("detects tampering when amountCents is modified (hashSelf mismatch)", async () => {
    // Start from a clean chain
    await prisma.taxLedgerEntry.deleteMany({ where: { orgId, period } });

    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "CREDIT",
      amountCents: 10_000,
      description: "Original entry",
    });

    await appendLedgerEntry({
      orgId,
      period,
      category: "PAYGW",
      direction: "CREDIT",
      amountCents: 2_000,
      description: "Second entry",
    });

    // Tamper directly in the DB: change amountCents of the second entry
    const entries = await prisma.taxLedgerEntry.findMany({
      where: { orgId, period },
      orderBy: { createdAt: "asc" },
    });

    expect(entries.length).toBe(2);

    const second = entries[1];

    await prisma.taxLedgerEntry.update({
      where: { id: second.id },
      data: {
        // Int column → use plain number
        amountCents: 9_999,
      },
    });

    const result = await verifyLedgerChain(orgId, period);

    expect(result.ok).toBe(false);
    expect(result.firstInvalidIndex).toBeGreaterThanOrEqual(1);
    expect(result.reason).toContain("hashSelf mismatch");
  });

  it("detects tampering when hashPrev is modified (hashPrev mismatch)", async () => {
    // Start from a clean chain
    await prisma.taxLedgerEntry.deleteMany({ where: { orgId, period } });

    await appendLedgerEntry({
      orgId,
      period,
      category: "GST",
      direction: "CREDIT",
      amountCents: 4_000,
      description: "First GST entry",
    });

    await appendLedgerEntry({
      orgId,
      period,
      category: "GST",
      direction: "CREDIT",
      amountCents: 1_000,
      description: "Second GST entry",
    });

    const entries = await prisma.taxLedgerEntry.findMany({
      where: { orgId, period },
      orderBy: { createdAt: "asc" },
    });

    expect(entries.length).toBe(2);

    const second = entries[1];

    // Tamper hashPrev only
    await prisma.taxLedgerEntry.update({
      where: { id: second.id },
      data: {
        hashPrev: "deadbeef-not-a-real-hash",
      },
    });

    const result = await verifyLedgerChain(orgId, period);

    expect(result.ok).toBe(false);
    expect(result.firstInvalidIndex).toBe(1);
    expect(result.reason).toContain("hashPrev mismatch");
  });
});
