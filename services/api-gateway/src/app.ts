import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

// NOTE: make sure config.ts exports what we discussed earlier,
// including cors.allowedOrigins: string[]
import { config } from "./config.js";

import { authGuard } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";

const prisma = new PrismaClient();

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  // --- CORS REGISTRATION ---
  // Allow frontend at http://localhost:5173 to call us at http://localhost:3000
  await app.register(cors, {
    origin: (origin, cb) => {
      // Browser will pass origin like "http://localhost:5173"
      // Non-browser clients (curl, PowerShell) might send no origin.
      if (!origin) {
        // allow same-network tools like curl / Invoke-WebRequest
        return cb(null, true);
      }

      const allowed = config.cors.allowedOrigins;
      if (allowed.includes(origin)) {
        return cb(null, true);
      }

      // not allowed
      cb(new Error("CORS not allowed"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // simple public healthcheck
  app.get("/health", async () => {
    return { ok: true, service: "api-gateway" };
  });

  // /auth/login (public)
  await registerAuthRoutes(app);

  // ---- Everything below this point requires auth ----

  // GET /users
  app.get(
    "/users",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      const masked = users.map((u) => {
        const [local, domain] = u.email.split("@");
        const safeLocal =
          local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "*";
        return {
          userId: u.id,
          email: `${safeLocal}@${domain}`,
          createdAt: u.createdAt,
        };
      });

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "users.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send({ users: masked });
    }
  );

  // GET /bank-lines
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

      const shaped = lines.map((ln) => ({
        id: ln.id,
        postedAt: ln.date,
        amount: Number(ln.amount),
        description: "***",
        createdAt: ln.createdAt,
      }));

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

  // POST /bank-lines
  app.post(
    "/bank-lines",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

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

      const cryptoSafeId = crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 16);

      const newLine = await prisma.bankLine.create({
        data: {
          id: cryptoSafeId,
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

  // GET /admin/export/:orgId
  app.get(
    "/admin/export/:orgId",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const { orgId } = request.params as { orgId: string };

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
            payee: b.payeeCiphertext,
            desc: b.descCiphertext,
            createdAt: b.createdAt,
          })),
        },
      });
    }
  );

  return app;
}
