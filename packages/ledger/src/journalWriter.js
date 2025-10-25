import { createHash } from "node:crypto";
export class JournalWriter {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async write(input) {
        if (input.postings.length === 0) {
            throw new UnbalancedJournalError("journal requires at least one posting");
        }
        const total = input.postings.reduce((sum, posting) => sum + BigInt(posting.amountCents), BigInt(0));
        if (total !== BigInt(0)) {
            throw new UnbalancedJournalError("journal postings must balance to zero");
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const last = await tx.journal.findFirst({
                where: { orgId: input.orgId },
                orderBy: { seq: "desc" },
                select: { seq: true, hash: true },
            });
            const nextSeq = (last?.seq ?? BigInt(0)) + BigInt(1);
            const prevHash = last?.hash ?? null;
            const hash = computeHash(prevHash, input);
            try {
                const createdJournal = await tx.journal.create({
                    data: {
                        orgId: input.orgId,
                        seq: nextSeq,
                        type: input.type,
                        eventId: input.eventId,
                        dedupeId: input.dedupeId,
                        occurredAt: input.occurredAt,
                        source: input.source,
                        description: input.description,
                        hash,
                        prevHash,
                        postings: {
                            create: input.postings.map((posting) => ({
                                orgId: input.orgId,
                                accountId: posting.accountId,
                                amountCents: BigInt(posting.amountCents),
                                memo: posting.memo,
                            })),
                        },
                    },
                    include: { postings: true },
                });
                return { journal: createdJournal, created: true };
            }
            catch (error) {
                if (isUniqueViolation(error)) {
                    const existing = await tx.journal.findFirst({
                        where: { orgId: input.orgId, dedupeId: input.dedupeId },
                        include: { postings: true },
                    });
                    if (existing) {
                        return { journal: existing, created: false };
                    }
                }
                throw error;
            }
        });
        return result;
    }
}
export class UnbalancedJournalError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnbalancedJournalError";
    }
}
function computeHash(prevHash, input) {
    const hasher = createHash("sha256");
    if (prevHash) {
        hasher.update(prevHash);
    }
    hasher.update(input.orgId);
    hasher.update(input.eventId);
    hasher.update(input.dedupeId);
    hasher.update(input.type);
    hasher.update(input.occurredAt.toISOString());
    hasher.update(input.source);
    for (const posting of input.postings) {
        hasher.update(posting.accountId);
        hasher.update(BigInt(posting.amountCents).toString());
        hasher.update(posting.memo ?? "");
    }
    return hasher.digest("hex");
}
function isUniqueViolation(error) {
    const candidate = error;
    return candidate?.code === "P2002";
}
