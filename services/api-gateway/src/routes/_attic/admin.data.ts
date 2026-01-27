import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data.js";

export type Principal = {
  id: string;
  orgId: string;
  role?: string;
  roles?: string[];
};

export type SecurityLogEntry = {
  event: string;
  orgId: string;
  principal: string;
  subjectEmail?: string;
  correlationId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

// Fastify decorations expected by your node tests
type DbClient = any;

function redactEmail(email: string): string {
  // matches your tests’ expected “[REDACTED:EMAIL]”
  return "[REDACTED:EMAIL]";
}

function nowIso(): string {
  return new Date().toISOString();
}

async function requireAdmin(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<Principal | null> {
  const authFn = (app as any).adminDataAuth as
    | ((
        req: FastifyRequest,
        reply: FastifyReply,
        roles: ReadonlyArray<string>,
      ) => Promise<Principal | null>)
    | undefined;

  if (!authFn) {
    reply.code(500).send({ error: "admin_auth_not_configured" });
    return null;
  }

  const principal = await authFn(req, reply, ["admin"]);
  if (!principal) return null;

  const role = principal.role ?? principal.roles?.[0] ?? "";
  if (role !== "admin") {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }

  return principal;
}

function emitSecurityLog(app: FastifyInstance, entry: SecurityLogEntry) {
  const sink = (app as any).secLog as ((e: SecurityLogEntry) => void) | undefined;
  if (typeof sink === "function") sink(entry);
}

export default async function adminDataRoutes(app: FastifyInstance) {
  const db: DbClient = (app as any).db;
  if (!db) {
    throw new Error("db is not decorated on fastify instance (expected app.decorate('db', ...)).");
  }

  // POST /admin/data/export
  app.post(
    "/data/export",
    {
      // In prototype-admin mode, app.authGuard is prototypeAdminGuard.
      // In secure mode, preHandler comes from jwt guard.
      preHandler: async (req, reply) => {
        const guard = (app as any).authGuard as any;
        if (typeof guard === "function") {
          // prototypeAdminGuard returns a preHandler function; allow both shapes:
          const maybe = guard(req, reply);
          if (typeof maybe === "function") return maybe(req, reply);
          return maybe;
        }
      },
    },
    async (req, reply) => {
      const principal = await requireAdmin(app, req, reply);
      if (!principal) return;

      const parsed = subjectDataExportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
        return;
      }

      const { orgId, email } = parsed.data;

      const user = await db.user.findFirst({
        where: { orgId, email },
        select: { id: true, email: true, createdAt: true, orgId: true },
      });

      if (!user) {
        reply.code(404).send({ error: "not_found" });
        return;
      }

      const bankLinesCount = await db.bankLine.count({
        where: { orgId },
      });

      // Access log
      await db.accessLog.create({
        data: {
          event: "data_export",
          orgId,
          principalId: principal.id,
          subjectEmail: email,
          occurredAt: new Date(),
        },
      });

      // Security log
      emitSecurityLog(app, {
        event: "data_export",
        orgId,
        principal: principal.id,
        subjectEmail: redactEmail(email),
        correlationId: String(req.headers["x-correlation-id"] ?? ""),
        occurredAt: nowIso(),
      });

      const responsePayload = {
        org: { id: orgId },
        user: {
          id: user.id,
          email: user.email,
          createdAt: new Date(user.createdAt).toISOString(),
        },
        relationships: { bankLinesCount },
        exportedAt: nowIso(),
      };

      // Validate response shape (keeps you honest)
      const checked = subjectDataExportResponseSchema.parse(responsePayload);
      reply.code(200).send(checked);
    },
  );

  // POST /admin/data/delete
  app.post(
    "/data/delete",
    {
      preHandler: async (req, reply) => {
        const guard = (app as any).authGuard as any;
        if (typeof guard === "function") {
          const maybe = guard(req, reply);
          if (typeof maybe === "function") return maybe(req, reply);
          return maybe;
        }
      },
    },
    async (req, reply) => {
      const principal = await requireAdmin(app, req, reply);
      if (!principal) return;

      const parsed = adminDataDeleteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
        return;
      }

      const { orgId, email } = parsed.data;

      const user = await db.user.findFirst({
        where: { orgId, email },
        select: { id: true, email: true, orgId: true },
      });

      if (!user) {
        reply.code(404).send({ error: "not_found" });
        return;
      }

      let action: "deleted" | "anonymized" = "deleted";
      const occurredAt = new Date();

      try {
        await db.user.delete({ where: { id: user.id } });
      } catch {
        // If hard delete is blocked by FK constraints, anonymize
        action = "anonymized";
        const tombstoneEmail = `deleted+${user.id}@example.invalid`;
        await db.user.update({
          where: { id: user.id },
          data: {
            email: tombstoneEmail,
            deletedAt: occurredAt,
          },
        });
      }

      await db.accessLog.create({
        data: {
          event: "data_delete",
          orgId,
          principalId: principal.id,
          subjectEmail: email,
          occurredAt,
        },
      });

      emitSecurityLog(app, {
        event: "data_delete",
        orgId,
        principal: principal.id,
        subjectEmail: redactEmail(email),
        correlationId: String(req.headers["x-correlation-id"] ?? ""),
        occurredAt: occurredAt.toISOString(),
      });

      const responsePayload = {
        action,
        userId: user.id,
        occurredAt: occurredAt.toISOString(),
      };

      const checked = adminDataDeleteResponseSchema.parse(responsePayload);
      reply.code(200).send(checked);
    },
  );
}

// Keep named export for convenience
export async function registerAdminDataRoutes(app: FastifyInstance) {
  return adminDataRoutes(app);
}
