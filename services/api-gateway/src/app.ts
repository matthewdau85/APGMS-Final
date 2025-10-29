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

  app.get(
    "/org/obligations/current",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        basPeriodStart: "2025-10-01",
        basPeriodEnd: "2025-10-31",
        paygw: {
          required: 12345.67,
          secured: 12000,
          shortfall: 345.67,
          status: "SHORTFALL",
        },
        gst: {
          required: 9876.54,
          secured: 9876.54,
          shortfall: 0,
          status: "READY",
        },
        nextBasDue: "2025-11-21T00:00:00Z",
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "org.obligations.current",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  app.get(
    "/feeds/payroll",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        runs: [
          {
            id: "run-2025-10-15",
            date: "2025-10-15",
            grossWages: 45000,
            paygwCalculated: 8200,
            paygwSecured: 8000,
            status: "PARTIAL",
          },
        ],
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "feeds.payroll.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  app.get(
    "/feeds/gst",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        days: [
          {
            date: "2025-10-15",
            salesTotal: 12000,
            gstCalculated: 1090,
            gstSecured: 1090,
            status: "OK",
          },
          {
            date: "2025-10-16",
            salesTotal: 9000,
            gstCalculated: 818,
            gstSecured: 600,
            status: "SHORT",
          },
        ],
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "feeds.gst.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  app.get(
    "/alerts",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        alerts: [
          {
            id: "alrt-1",
            type: "GST_SHORTFALL",
            severity: "HIGH",
            message: "GST secured is lower than GST calculated",
            createdAt: "2025-10-16T10:00:00Z",
            resolved: false,
          },
        ],
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "alerts.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  app.get(
    "/bas/preview",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        periodStart: "2025-10-01",
        periodEnd: "2025-10-31",
        paygw: {
          required: 12345.67,
          secured: 12000,
          status: "BLOCKED",
        },
        gst: {
          required: 9876.54,
          secured: 9876.54,
          status: "READY",
        },
        overallStatus: "BLOCKED",
        blockers: [
          "PAYGW not fully funded. $345.67 short. Transfer to ATO is halted until funded or plan requested.",
        ],
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "bas.preview",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  app.get(
    "/compliance/report",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        orgId,
        basHistory: [
          {
            period: "2025 Q3",
            lodgedAt: "2025-10-28T01:00:00Z",
            status: "ON_TIME",
            notes: "All obligations secured pre-lodgment",
          },
        ],
        alertsSummary: {
          openHighSeverity: 1,
          resolvedThisQuarter: 3,
        },
        nextBasDue: "2025-11-21T00:00:00Z",
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "compliance.report",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  app.get(
    "/security/users",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        users: [
          {
            id: "dev-user",
            email: "dev@example.com",
            role: "admin",
            mfaEnabled: false,
            lastLogin: "2025-10-28T00:00:00Z",
          },
        ],
      };

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "security.users.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send(data);
    }
  );

  return app;
}
