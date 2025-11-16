

import { describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import { JournalWriter, UnbalancedJournalError } from "../src/journalWriter";

type JournalRecord = {
  id: string;
  orgId: string;
  seq: bigint;
  type: string;
  eventId: string;
  dedupeId: string;
  occurredAt: Date;
  source: string;
  description?: string | null;
  hash?: string | null;
  prevHash?: string | null;
};

type PostingRecord = {
  id: string;
  orgId: string;
  journalId: string;
  accountId: string;
  amountCents: bigint;
  memo?: string | null;
};

const now = () => new Date("2025-10-24T00:00:00Z");

describe("JournalWriter", () => {
  it("throws when postings are unbalanced", async () => {
    const prisma = createFakePrisma();
    const writer = new JournalWriter(prisma as unknown as PrismaClient);

    await expect(
      writer.write({
        orgId: "org-1",
        eventId: "event-1",
        dedupeId: "dup-1",
        type: "PAYROLL_HOLD",
        occurredAt: now(),
        source: "test",
        postings: [
          { accountId: "acct-a", amountCents: 100n },
          { accountId: "acct-b", amountCents: 10n },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalError);
  });

  it("persists balanced journals and increments sequence", async () => {
    const prisma = createFakePrisma();
    const writer = new JournalWriter(prisma as unknown as PrismaClient);

    const first = await writer.write({
      orgId: "org-1",
      eventId: "event-1",
      dedupeId: "dup-1",
      type: "PAYROLL_HOLD",
      occurredAt: now(),
      source: "test",
      postings: [
        { accountId: "acct-a", amountCents: 100n },
        { accountId: "acct-b", amountCents: -100n },
      ],
    });

    expect(first.created).toBe(true);
    expect(first.journal.seq).toBe(1n);
    expect(first.journal.postings).toHaveLength(2);

    const second = await writer.write({
      orgId: "org-1",
      eventId: "event-2",
      dedupeId: "dup-2",
      type: "PAYROLL_HOLD",
      occurredAt: now(),
      source: "test",
      postings: [
        { accountId: "acct-a", amountCents: 50n },
        { accountId: "acct-b", amountCents: -50n },
      ],
    });

    expect(second.created).toBe(true);
    expect(second.journal.seq).toBe(2n);
  });

  it("returns existing journal on idempotent retry", async () => {
    const prisma = createFakePrisma();
    const writer = new JournalWriter(prisma as unknown as PrismaClient);

    const first = await writer.write({
      orgId: "org-1",
      eventId: "event-1",
      dedupeId: "dup-1",
      type: "PAYROLL_HOLD",
      occurredAt: now(),
      source: "test",
      postings: [
        { accountId: "acct-a", amountCents: 10n },
        { accountId: "acct-b", amountCents: -10n },
      ],
    });
    const second = await writer.write({
      orgId: "org-1",
      eventId: "event-1",
      dedupeId: "dup-1",
      type: "PAYROLL_HOLD",
      occurredAt: now(),
      source: "test",
      postings: [
        { accountId: "acct-a", amountCents: 10n },
        { accountId: "acct-b", amountCents: -10n },
      ],
    });

    expect(second.created).toBe(false);
    expect(second.journal.id).toEqual(first.journal.id);
  });
});

function createFakePrisma() {
  const journals: JournalRecord[] = [];
  const postings: PostingRecord[] = [];

  const prisma = {
    journal: {
      findFirst: async (args: any) => {
        const filtered = journals
          .filter((j) => j.orgId === args.where.orgId)
          .sort((a, b) => Number(b.seq - a.seq));
        if (args.orderBy?.seq === "desc") {
          return filtered[0] ?? null;
        }
        if (args.where?.dedupeId) {
          return (
            journals
              .filter((j) => j.orgId === args.where.orgId && j.dedupeId === args.where.dedupeId)
              .map((j) => ({
                ...j,
                postings: postings.filter((p) => p.journalId === j.id),
              }))[0] ?? null
          );
        }
        return filtered[0] ?? null;
      },
      create: async (args: any) => {
        const { data, include } = args;

        if (journals.some((j) => j.orgId === data.orgId && j.dedupeId === data.dedupeId)) {
          const error = new Error("duplicate") as any;
          error.code = "P2002";
          error.meta = { target: ["orgId", "dedupeId"] };
          throw error;
        }

        const journal: JournalRecord = {
          id: `journal-${journals.length + 1}`,
          orgId: data.orgId,
          seq: BigInt(data.seq),
          type: data.type,
          eventId: data.eventId,
          dedupeId: data.dedupeId,
          occurredAt: data.occurredAt,
          source: data.source,
          description: data.description ?? null,
          hash: data.hash ?? null,
          prevHash: data.prevHash ?? null,
        };
        journals.push(journal);

        const createdPostings: PostingRecord[] = (data.postings?.create ?? []).map((p: any, index: number) => {
          const posting: PostingRecord = {
            id: `posting-${journals.length}-${index}`,
            orgId: p.orgId,
            journalId: journal.id,
            accountId: p.accountId,
            amountCents: BigInt(p.amountCents),
            memo: p.memo ?? null,
          };
          postings.push(posting);
          return posting;
        });

        if (include?.postings) {
          return { ...journal, postings: createdPostings };
        }
        return journal;
      },
    },
    $transaction: async (handler: any) => handler(prisma),
  };

  return prisma;
}
