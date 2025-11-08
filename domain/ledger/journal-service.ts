import { JournalWriter, type JournalWriteInput, type JournalWriteResult } from "@apgms/ledger";
import type { PrismaClient } from "@prisma/client";

import type { AnalyticsEventLogger } from "./analytics-events.js";

export type LedgerContext = {
  prisma: PrismaClient;
  analyticsLogger?: AnalyticsEventLogger;
};

export type LedgerJournalInput = JournalWriteInput & {
  analyticsPayload?: Record<string, unknown>;
};

export async function writeLedgerJournal(
  context: LedgerContext,
  input: LedgerJournalInput,
): Promise<JournalWriteResult> {
  const writer = new JournalWriter(context.prisma);
  const result = await writer.write(input);

  if (context.analyticsLogger) {
    await context.analyticsLogger({
      orgId: input.orgId,
      eventType: "journal.write",
      occurredAt: input.occurredAt,
      payload: {
        eventId: input.eventId,
        dedupeId: input.dedupeId,
        type: input.type,
        description: input.description ?? null,
        source: input.source,
        postings: input.postings.map((posting) => ({
          accountId: posting.accountId,
          amountCents: BigInt(posting.amountCents).toString(),
          memo: posting.memo ?? null,
        })),
        analytics: input.analyticsPayload ?? null,
      },
      labels: {
        created: result.created,
        type: input.type,
      },
    });
  }

  return result;
}
