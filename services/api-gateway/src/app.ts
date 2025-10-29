import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  PrismaClient,
  Prisma,
  Alert as AlertModel,
  BasCycle as BasCycleModel,
  DesignatedAccount as DesignatedAccountModel,
  DesignatedTransfer as DesignatedTransferModel,
} from "@prisma/client";
import crypto from "node:crypto";

// NOTE: make sure config.ts exports what we discussed earlier,
// including cors.allowedOrigins: string[]
import { config } from "./config.js";

import { authGuard } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";

const prisma = new PrismaClient();

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

type DesignatedAccountView = {
  id: string;
  type: string;
  balance: number;
  updatedAt: string;
  transfers: Array<{
    id: string;
    amount: number;
    source: string;
    createdAt: string;
  }>;
};

type DesignatedAccountContext = {
  accounts: DesignatedAccountView[];
  totals: {
    paygw: number;
    gst: number;
  };
};

function shapeAlert(alert: AlertModel) {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    createdAt: alert.createdAt,
    resolved: Boolean(alert.resolvedAt),
    resolvedAt: alert.resolvedAt ?? null,
    resolutionNote: alert.resolutionNote ?? null,
  };
}

function shapeBasPreview(
  cycle: BasCycleModel | null,
  balances?: { paygw: number; gst: number }
) {
  if (!cycle) {
    return null;
  }

  const paygwRequired = decimalToNumber(cycle.paygwRequired);
  const paygwSecured =
    balances?.paygw ?? decimalToNumber(cycle.paygwSecured);
  const paygwShortfall = Math.max(0, paygwRequired - paygwSecured);
  const gstRequired = decimalToNumber(cycle.gstRequired);
  const gstSecured = balances?.gst ?? decimalToNumber(cycle.gstSecured);
  const gstShortfall = Math.max(0, gstRequired - gstSecured);

  const paygwStatus = paygwShortfall <= 0 ? "READY" : "BLOCKED";
  const gstStatus = gstShortfall <= 0 ? "READY" : "BLOCKED";
  const overallStatus =
    paygwStatus === "READY" && gstStatus === "READY" ? "READY" : "BLOCKED";

  const blockers: string[] = [];
  if (paygwShortfall > 0) {
    blockers.push(
      `PAYGW not fully funded. $${paygwShortfall.toFixed(
        2
      )} short. Transfer to ATO is halted until funded or plan requested.`
    );
  }
  if (gstShortfall > 0) {
    blockers.push(
      `GST not fully funded. $${gstShortfall.toFixed(
        2
      )} short. Review daily capture and top up the holding account.`
    );
  }

  return {
    periodStart: cycle.periodStart.toISOString(),
    periodEnd: cycle.periodEnd.toISOString(),
    paygw: {
      required: paygwRequired,
      secured: paygwSecured,
      status: paygwStatus,
      shortfall: Number(paygwShortfall.toFixed(2)),
    },
    gst: {
      required: gstRequired,
      secured: gstSecured,
      status: gstStatus,
      shortfall: Number(gstShortfall.toFixed(2)),
    },
    overallStatus,
    blockers,
    lodgedAt: cycle.lodgedAt ?? null,
  };
}

function formatBasPeriod(start: Date, end: Date): string {
  const year = start.getUTCFullYear();
  const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
  return `${year} Q${quarter}`;
}

async function loadDesignatedAccountContext(orgId: string): Promise<DesignatedAccountContext> {
  const accounts = await prisma.designatedAccount.findMany({
    where: { orgId },
    orderBy: { type: "asc" },
    include: {
      transfers: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  const shaped: DesignatedAccountView[] = accounts.map(
    (account: DesignatedAccountModel & { transfers: DesignatedTransferModel[] }) => ({
      id: account.id,
      type: account.type.toUpperCase(),
      balance: decimalToNumber(account.balance),
      updatedAt: account.updatedAt.toISOString(),
      transfers: account.transfers.map((transfer) => ({
        id: transfer.id,
        amount: decimalToNumber(transfer.amount),
        source: transfer.source,
        createdAt: transfer.createdAt.toISOString(),
      })),
    })
  );

  const totals = shaped.reduce(
    (acc, account) => {
      if (account.type === "PAYGW") {
        acc.paygw += account.balance;
      } else if (account.type === "GST") {
        acc.gst += account.balance;
      }
      return acc;
    },
    { paygw: 0, gst: 0 }
  );

  return { accounts: shaped, totals };
}

async function syncBasCycleSecured(
  cycle: BasCycleModel,
  balances: { paygw: number; gst: number }
): Promise<BasCycleModel> {
  const paygwRequired = decimalToNumber(cycle.paygwRequired);
  const gstRequired = decimalToNumber(cycle.gstRequired);
  const paygwStatus = balances.paygw >= paygwRequired ? "READY" : "BLOCKED";
  const gstStatus = balances.gst >= gstRequired ? "READY" : "BLOCKED";
  const overallStatus =
    paygwStatus === "READY" && gstStatus === "READY" ? "READY" : "BLOCKED";

  const currentPaygw = decimalToNumber(cycle.paygwSecured);
  const currentGst = decimalToNumber(cycle.gstSecured);
  const shouldUpdate =
    Math.abs(currentPaygw - balances.paygw) > 0.01 ||
    Math.abs(currentGst - balances.gst) > 0.01 ||
    cycle.overallStatus !== overallStatus;

  if (!shouldUpdate) {
    return cycle;
  }

  return prisma.basCycle.update({
    where: { id: cycle.id },
    data: {
      paygwSecured: balances.paygw,
      gstSecured: balances.gst,
      overallStatus,
    },
  });
}

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

      const designatedContext = await loadDesignatedAccountContext(orgId);

      let cycle = await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

      if (cycle) {
        cycle = await syncBasCycleSecured(cycle, designatedContext.totals);
      }

      const preview = shapeBasPreview(cycle, designatedContext.totals);
      const response = preview
        ? {
            basPeriodStart: preview.periodStart,
            basPeriodEnd: preview.periodEnd,
            paygw: {
              required: preview.paygw.required,
              secured: preview.paygw.secured,
              shortfall: preview.paygw.shortfall,
              status:
                preview.paygw.shortfall > 0 ? "SHORTFALL" : preview.paygw.status,
            },
            gst: {
              required: preview.gst.required,
              secured: preview.gst.secured,
              shortfall: preview.gst.shortfall,
              status:
                preview.gst.shortfall > 0 ? "SHORTFALL" : preview.gst.status,
            },
            nextBasDue: preview.periodEnd,
          }
        : {
            basPeriodStart: null,
            basPeriodEnd: null,
            paygw: {
              required: 0,
              secured: 0,
              shortfall: 0,
              status: "READY",
            },
            gst: {
              required: 0,
              secured: 0,
              shortfall: 0,
              status: "READY",
            },
            nextBasDue: null,
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

      reply.send(response);
    }
  );

  app.get(
    "/org/designated-accounts",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const context = await loadDesignatedAccountContext(orgId);

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "org.designatedAccounts.list",
            metadata: {},
          },
        });
      } catch (_) {}

      reply.send({
        accounts: context.accounts,
        totals: context.totals,
      });
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

      const alerts = await prisma.alert.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      });

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

      reply.send({
        alerts: alerts.map((alert) => shapeAlert(alert)),
      });
    }
  );

  app.post(
    "/alerts/:id/resolve",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const { id } = request.params as { id: string };
      const body = request.body as { note?: string } | undefined;

      if (!body?.note || body.note.trim().length === 0) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "Resolution note is required",
          },
        });
        return;
      }

      const alert = await prisma.alert.findUnique({
        where: { id },
      });

      if (!alert || alert.orgId !== orgId) {
        reply.code(404).send({
          error: { code: "alert_not_found", message: "No such alert" },
        });
        return;
      }

      if (alert.resolvedAt) {
        reply.code(409).send({
          error: {
            code: "already_resolved",
            message: "Alert already resolved",
          },
        });
        return;
      }

      const resolved = await prisma.alert.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolutionNote: body.note,
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "alert.resolve",
            metadata: { alertId: id },
          },
        });
      } catch (_) {}

      reply.send({ alert: shapeAlert(resolved) });
    }
  );

  app.get(
    "/bas/preview",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const context = await loadDesignatedAccountContext(orgId);

      let cycle = await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

      if (cycle) {
        cycle = await syncBasCycleSecured(cycle, context.totals);
      }

      const preview = shapeBasPreview(cycle, context.totals);
      const payload = preview
        ? {
            periodStart: preview.periodStart,
            periodEnd: preview.periodEnd,
            paygw: {
              required: preview.paygw.required,
              secured: preview.paygw.secured,
              status: preview.paygw.status,
            },
            gst: {
              required: preview.gst.required,
              secured: preview.gst.secured,
              status: preview.gst.status,
            },
            overallStatus: preview.overallStatus,
            blockers: preview.blockers,
          }
        : {
            periodStart: null,
            periodEnd: null,
            paygw: { required: 0, secured: 0, status: "READY" },
            gst: { required: 0, secured: 0, status: "READY" },
            overallStatus: "READY",
            blockers: [],
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

      reply.send(payload);
    }
  );

  app.post(
    "/bas/lodge",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const context = await loadDesignatedAccountContext(orgId);

      let cycle = await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

      if (!cycle) {
        reply.code(404).send({
          error: {
            code: "bas_cycle_not_found",
            message: "No active BAS cycle",
          },
        });
        return;
      }

      cycle = await syncBasCycleSecured(cycle, context.totals);
      const preview = shapeBasPreview(cycle, context.totals);
      if (!preview || preview.overallStatus !== "READY") {
        reply.code(409).send({
          error: {
            code: "bas_cycle_blocked",
            message: "BAS cycle not ready for lodgment",
          },
        });
        return;
      }

      const lodgmentTime = new Date();
      const updated = await prisma.basCycle.update({
        where: { id: cycle.id },
        data: {
          overallStatus: "LODGED",
          lodgedAt: lodgmentTime,
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            orgId,
            actorId: userClaims.sub,
            action: "bas.lodge",
            metadata: { basCycleId: updated.id },
          },
        });
      } catch (_) {}

      reply.send({
        basCycle: {
          id: updated.id,
          status: updated.overallStatus,
          lodgedAt: updated.lodgedAt?.toISOString() ?? lodgmentTime.toISOString(),
        },
      });
    }
  );

  app.get(
    "/compliance/report",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const [basCycles, alerts, designatedContext] = await Promise.all([
        prisma.basCycle.findMany({
          where: { orgId },
          orderBy: { periodStart: "desc" },
          take: 8,
        }),
        prisma.alert.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
        }),
        loadDesignatedAccountContext(orgId),
      ]);

      const activeIndex = basCycles.findIndex((cycle) => cycle.lodgedAt === null);
      if (activeIndex >= 0) {
        basCycles[activeIndex] = await syncBasCycleSecured(
          basCycles[activeIndex],
          designatedContext.totals
        );
      }

      const activeCycle = activeIndex >= 0 ? basCycles[activeIndex] : null;

      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);

      const complianceReport = {
        orgId,
        basHistory: basCycles.map((cycle) => {
          const periodLabel = formatBasPeriod(cycle.periodStart, cycle.periodEnd);
          const paygwReady =
            decimalToNumber(cycle.paygwSecured) >=
            decimalToNumber(cycle.paygwRequired);
          const gstReady =
            decimalToNumber(cycle.gstSecured) >= decimalToNumber(cycle.gstRequired);
          const readinessNote = [
            `PAYGW ${paygwReady ? "secured" : "short"}`,
            `GST ${gstReady ? "secured" : "short"}`,
          ].join("; ");

          return {
            period: periodLabel,
            lodgedAt: cycle.lodgedAt?.toISOString() ?? null,
            status:
              cycle.overallStatus === "LODGED"
                ? "ON_TIME"
                : cycle.overallStatus.toUpperCase(),
            notes: readinessNote,
          };
        }),
        alertsSummary: {
          openHighSeverity: alerts.filter(
            (alert) => alert.severity === "HIGH" && !alert.resolvedAt
          ).length,
          resolvedThisQuarter: alerts.filter(
            (alert) => alert.resolvedAt && alert.resolvedAt >= quarterStart
          ).length,
        },
        nextBasDue: activeCycle?.periodEnd.toISOString() ?? null,
        designatedTotals: designatedContext.totals,
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

      reply.send(complianceReport);
    }
  );

  app.get(
    "/security/users",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          role: true,
          mfaEnabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

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

      reply.send({
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt.toISOString(),
          lastLogin: user.createdAt.toISOString(),
        })),
      });
    }
  );

  return app;
}
