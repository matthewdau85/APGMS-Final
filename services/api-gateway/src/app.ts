// services/api-gateway/src/app.ts
import Fastify, { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { authGuard } from "./auth";
import { registerAuthRoutes } from "./routes/auth";

// NOTE: you probably already had similar startup code that did waiting-for-Postgres,
// rate limits, CORS, etc. Keep that if you have it.
// Below is a minimal working shape.

const prisma = new PrismaClient();

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  // health is public
  app.get("/health", async () => {
    return { ok: true, service: "api-gateway" };
  });

  // auth/login (public)
  await registerAuthRoutes(app);

  // protect everything below this line ---------------------------------

  // list users for current org (masked email etc.)
  app.get(
    "/users",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      // get users in same org
      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      // light masking of email for demo: "de*@example.com"
      const masked = users.map((u) => {
        const [local, domain] = u.email.split("@");
        const safeLocal =
          local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "*";
        return {
          userId: u.id.slice(0, 16), // short id for UI
          email: `${safeLocal}@${domain}`,
          createdAt: u.createdAt,
        };
      });

      // audit log insert (best effort)
      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "users.list",
            metadata: {},
          },
        });
      } catch (e) {
        // swallow errors to not break prod
      }

      reply.send({ users: masked });
    }
  );

  // GET /bank-lines (list lines for your org)
  app.get(
    "/bank-lines",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const lines = await prisma.bankLine.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          date: true,
          amount: true,
          descCiphertext: true,
          createdAt: true,
        },
      });

      // what we return to client:
      // - "postedAt" (date)
      // - "amount"
      // - "description" masked (***)
      const shaped = lines.map((ln) => ({
        id: ln.id.slice(0, 16),
        postedAt: ln.date,
        amount: Number(ln.amount),
        description: "***", // redacted PII
        createdAt: ln.createdAt,
      }));

      // audit
      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "bankLines.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send({ lines: shaped });
    }
  );

  // POST /bank-lines (add one)
  app.post(
    "/bank-lines",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      // validate body
      const body = request.body as {
        date?: string;
        amount?: string;
        payee?: string;
        desc?: string;
      };

      if (
        !body?.date ||
        !body?.amount ||
        !body?.payee ||
        !body?.desc
      ) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "date, amount, payee, desc are required",
          },
        });
        return;
      }

      // In real code you'd encrypt payee/desc using PII_KEYS.
      // For now we store them as ciphertext="***" with kid="dev".
      const newLine = await prisma.bankLine.create({
        data: {
          id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          orgId,
          date: new Date(body.date),
          amount: body.amount,
          payeeCiphertext: "***",
          payeeKid: "dev",
          descCiphertext: "***",
          descKid: "dev",
          idempotencyKey: null,
        },
      });

      // audit
      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "bankLines.create",
            metadata: { lineId: newLine.id },
          },
        });
      } catch (_) {}

      reply.code(201).send({
        line: {
          id: newLine.id,
          postedAt: newLine.date,
          amount: Number(newLine.amount),
          description: "***",
          createdAt: newLine.createdAt,
        },
      });
    }
  );

  // admin export
  app.get(
    "/admin/export/:orgId",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const { orgId } = request.params as { orgId: string };

      // simple authz check: must match your own org
      if (orgId !== userClaims.orgId) {
        reply.code(403).send({
          error: { code: "forbidden", message: "Cross-org export denied" },
        });
        return;
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
      });

      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      const bankLines = await prisma.bankLine.findMany({
        where: { orgId },
        select: {
          id: true,
          date: true,
          amount: true,
          payeeCiphertext: true,
          descCiphertext: true,
          createdAt: true,
        },
      });

      // audit
      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "admin.export",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send({
        export: {
          org,
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            createdAt: u.createdAt,
          })),
          bankLines: bankLines.map((b) => ({
            id: b.id,
            date: b.date,
            amount: Number(b.amount),
            payee: b.payeeCiphertext, // still masked/enc
            desc: b.descCiphertext,   // still masked/enc
            createdAt: b.createdAt,
          })),
        },
      });
    }
  );

  return app;
}

// If you start server directly from node dist/index.js or similar:
if (require.main === module) {
  (async () => {
    const app = await buildServer();
    await app.listen({ port: 3000, host: "0.0.0.0" });
    app.log.info("api-gateway listening on 3000");
  })();
}
