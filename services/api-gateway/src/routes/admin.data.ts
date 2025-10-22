import { createHash } from "node:crypto";
import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";

const principalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email(),
});

export type Principal = z.infer<typeof principalSchema>;

export type SecurityLogPayload =
  | {
      event: "data_export";
      orgId: string;
      principal: string;
      subjectEmail: string;
    }
  | {
      event: "data_delete";
      orgId: string;
      principal: string;
      subjectUserId: string;
      mode: "anonymized" | "deleted";
    };

type DbClient = {
  user: {
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  bankLine: {
    count: (args: any) => Promise<number>;
  };
  accessLog?: {
    create: (args: any) => Promise<unknown>;
  };
};

type AdminDataRouteDeps = {
  db?: DbClient;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
};

const PASSWORD_PLACEHOLDER = "__deleted__";

const adminDataRoutes: FastifyPluginAsync<AdminDataRouteDeps> = async (app, opts) => {
  const db = opts?.db ?? (app as any).db ?? (await loadDefaultDb());
  const secLog: (payload: SecurityLogPayload) => Promise<void> | void =
    opts?.secLog ??
    (app as any).secLog ??
    ((payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post("/admin/data/export", async (req, reply) => {
    const parsedBody = subjectDataExportRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const principal = parsePrincipal(req);
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (principal.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }

    const body = parsedBody.data;
    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const userRecord = await db.user.findFirst({
      where: { email: body.email, orgId: body.orgId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
    });

    if (!userRecord) {
      return reply.code(404).send({ error: "not_found" });
    }

    const bankLinesCount = await db.bankLine.count({
      where: { orgId: body.orgId },
    });

    const exportedAt = new Date().toISOString();

    if (db.accessLog?.create) {
      await db.accessLog.create({
        data: {
          event: "data_export",
          orgId: body.orgId,
          principalId: principal.id,
          subjectEmail: body.email,
        },
      });
    }

    secLog({
      event: "data_export",
      orgId: body.orgId,
      principal: principal.id,
      subjectEmail: body.email,
    });

    const responsePayload = {
      org: {
        id: userRecord.org.id,
        name: userRecord.org.name,
      },
      user: {
        id: userRecord.id,
        email: userRecord.email,
        createdAt: userRecord.createdAt instanceof Date
          ? userRecord.createdAt.toISOString()
          : new Date(userRecord.createdAt).toISOString(),
      },
      relationships: {
        bankLinesCount,
      },
      exportedAt,
    };

    const validated = subjectDataExportResponseSchema.parse(responsePayload);

    return reply.send(validated);
  });

  app.post("/admin/data/delete", async (req, reply) => {
    const principal = parsePrincipal(req);
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (principal.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }

    const parsedBody = adminDataDeleteRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsedBody.data;

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const subject = await db.user.findFirst({
      where: { orgId: body.orgId, email: body.email },
    });

    if (!subject) {
      return reply.code(404).send({ error: "not_found" });
    }

    const hasConstraintRisk = await detectForeignKeyRisk(
      db,
      subject.id,
      subject.email,
      subject.orgId ?? body.orgId
    );

    const occurredAt = new Date().toISOString();
    let response = adminDataDeleteResponseSchema.parse({
      action: "deleted" as const,
      userId: subject.id,
      occurredAt,
    });

    if (hasConstraintRisk) {
      const anonymizedEmail = anonymizeEmail(subject.email, subject.id);
      await db.user.update({
        where: { id: subject.id },
        data: {
          email: anonymizedEmail,
          password: PASSWORD_PLACEHOLDER,
        },
      });

      response = adminDataDeleteResponseSchema.parse({
        action: "anonymized",
        userId: subject.id,
        occurredAt,
      });
    } else {
      await db.user.delete({ where: { id: subject.id } });
    }

    await Promise.resolve(
      secLog({
        event: "data_delete",
        orgId: body.orgId,
        principal: principal.id,
        subjectUserId: subject.id,
        mode: response.action,
      })
    );

    return reply.code(202).send(response);
  });
};

const parsePrincipal = (req: FastifyRequest): Principal | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return principalSchema.parse(parsed);
  } catch {
    return null;
  }
};

async function detectForeignKeyRisk(
  db: DbClient,
  userId: string,
  email: string,
  orgId: string
): Promise<boolean> {
  const relatedLines = await db.bankLine.count({
    where: {
      orgId,
      payee: email,
    },
  });

  if (relatedLines > 0) {
    return true;
  }

  const otherRefs = await db.bankLine.count({
    where: {
      orgId,
      desc: {
        contains: userId,
      },
    },
  });

  return otherRefs > 0;
}

function anonymizeEmail(email: string, userId: string): string {
  const hash = createHash("sha256").update(`${email}:${userId}`).digest("hex");
  return `deleted+${hash.slice(0, 12)}@example.com`;
}

let cachedDefaultDb: DbClient | null = null;

async function loadDefaultDb(): Promise<DbClient> {
  if (!cachedDefaultDb) {
    const module = (await import("../../../../shared/src/db.js")) as {
      prisma: DbClient;
    };
    cachedDefaultDb = module.prisma;
  }
  return cachedDefaultDb;
}

export default adminDataRoutes;
