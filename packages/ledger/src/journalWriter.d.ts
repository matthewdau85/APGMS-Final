type BigIntLike = bigint | number;
/**
 * Minimal Prisma-like interface for the parts of the client we use here.
 * This avoids needing the PrismaClient type from @prisma/client directly,
 * which was causing the TS2305 error in the ledger build.
 */
export interface PrismaJournalClient {
    journal: {
        findFirst(args: any): Promise<{
            seq: bigint;
            hash: string | null;
        } | null>;
        create(args: any): Promise<any>;
    };
    $transaction<T>(fn: (tx: PrismaJournalClient) => Promise<T>): Promise<T>;
}
export interface PostingInput {
    accountId: string;
    amountCents: BigIntLike;
    memo?: string;
}
export interface JournalWriteInput {
    orgId: string;
    eventId: string;
    dedupeId: string;
    type: string;
    occurredAt: Date;
    source: string;
    description?: string;
    postings: ReadonlyArray<PostingInput>;
}
export interface JournalWriteResult {
    journal: any;
    created: boolean;
}
export declare class JournalWriter {
    private readonly prisma;
    constructor(prisma: PrismaJournalClient);
    write(input: JournalWriteInput): Promise<JournalWriteResult>;
}
export declare class UnbalancedJournalError extends Error {
    constructor(message: string);
}
export {};
//# sourceMappingURL=journalWriter.d.ts.map