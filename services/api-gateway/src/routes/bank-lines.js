import { z } from "zod";
import { assertOrgAccess, assertRoleForBankLines, redactBankLine } from "../utils/orgScope";
import prisma from "../db/client"; // adjust import to wherever your Prisma client lives
const createBankLineSchema = z.object({
    orgId: z.string().min(1),
    idempotencyKey: z.string().min(1),
    accountRef: z.string().min(1),
    amountCents: z.number().int(),
    currency: z.string().min(1)
    // add anything else you already validate
});
const bankLinesRoute = async (fastify) => {
    fastify.post("/bank-lines", async (request, reply) => {
        // 1. schema validation
        const parseResult = createBankLineSchema.safeParse(request.body);
        if (!parseResult.success) {
            reply.code(400).send({
                error: "invalid_body",
                details: parseResult.error.flatten()
            });
            return;
        }
        const data = parseResult.data;
        // 2. authz: same org + allowed role
        if (!assertOrgAccess(request, reply, data.orgId))
            return;
        if (!assertRoleForBankLines(request, reply))
            return;
        // 3. upsert-like logic using unique(orgId, idempotencyKey)
        // so we don't double-write money movements
        const record = await prisma.bankLine.upsert({
            where: {
                orgId_idempotencyKey: {
                    orgId: data.orgId,
                    idempotencyKey: data.idempotencyKey
                }
            },
            update: {},
            create: {
                orgId: data.orgId,
                idempotencyKey: data.idempotencyKey,
                accountRef: data.accountRef,
                amountCents: data.amountCents,
                currency: data.currency
            }
        });
        // 4. redact before replying
        reply.code(201).send(redactBankLine(record));
    });
    // Example GET (read)
    fastify.get("/bank-lines/:orgId", async (request, reply) => {
        const orgId = String(request.params.orgId);
        // authz
        if (!assertOrgAccess(request, reply, orgId))
            return;
        const rows = await prisma.bankLine.findMany({
            where: { orgId },
            orderBy: { createdAt: "desc" }
        });
        reply.send(rows.map(redactBankLine));
    });
};
export default bankLinesRoute;
