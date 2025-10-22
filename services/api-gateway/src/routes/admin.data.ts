<<<<<<< HEAD
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  type AdminDataDeleteRequest,
  type AdminDataDeleteResponse,
} from "../schemas/admin.data";

interface Principal {
  id: string;
  role: string;
  orgId: string;
  token: string;
}

export interface SecurityLogPayload {
  event: "data_delete";
  orgId: string;
  principal: string;
  subjectUserId: string;
  mode: "anonymized" | "deleted";
}

const PASSWORD_PLACEHOLDER = "__deleted__";

type SharedDbModule = typeof import("../../../../shared/src/db.js");
type PrismaClientLike = Pick<SharedDbModule["prisma"], "user" | "bankLine">;

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const prisma = deps.prisma ?? (await getDefaultPrisma());
  const securityLogger =
    deps.secLog ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post("/admin/data/delete", async (request, reply) => {
    const principal = parseAuthorization(request);
=======
import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";

const principalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email(),
});

type Principal = z.infer<typeof principalSchema>;

type DbClient = {
  user: {
    findFirst: (args: {
      where: { email: string; orgId: string };
      select: {
        id: true;
        email: true;
        createdAt: true;
        org: { select: { id: true; name: true } };
      };
    }) => Promise<
      | {
          id: string;
          email: string;
          createdAt: Date;
          org: { id: string; name: string };
        }
      | null
    >;
  };
  bankLine: {
    count: (args: { where: { orgId: string } }) => Promise<number>;
  };
  accessLog?: {
    create: (args: {
      data: {
        event: string;
        orgId: string;
        principalId: string;
        subjectEmail: string;
      };
    }) => Promise<unknown>;
  };
};

type SecLogFn = (payload: {
  event: string;
  orgId: string;
  principal: string;
  subjectEmail: string;
}) => void;

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

const adminDataRoutes: FastifyPluginAsync = async (app) => {
  const db: DbClient | undefined = (app as any).db;
  if (!db) {
    throw new Error("database client not registered");
  }

  const log: SecLogFn =
    (app as any).secLog ??
    ((entry) => {
      app.log.info({ event: entry.event, ...entry }, "security_event");
    });

  app.post("/admin/data/export", async (req, reply) => {
    const bodyResult = subjectDataExportRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = bodyResult.data;

    const principal = parsePrincipal(req);
>>>>>>> origin/codex/add-admin-gated-subject-data-export-endpoint
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (principal.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }

<<<<<<< HEAD
    const parsed = adminDataDeleteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

=======
>>>>>>> origin/codex/add-admin-gated-subject-data-export-endpoint
    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

<<<<<<< HEAD
    const subject = await prisma.user.findFirst({
      where: { orgId: body.orgId, email: body.email },
    });

    if (!subject) {
      return reply.code(404).send({ error: "not_found" });
    }

    const hasConstraintRisk = await detectForeignKeyRisk(
      prisma,
      subject.id,
      subject.email,
      subject.orgId
    );

    const occurredAt = new Date().toISOString();
    let response: AdminDataDeleteResponse;

    if (hasConstraintRisk) {
      const anonymizedEmail = anonymizeEmail(subject.email, subject.id);
      await prisma.user.update({
        where: { id: subject.id },
        data: {
          email: anonymizedEmail,
          passwordHash: PASSWORD_PLACEHOLDER,
        },
      });

      response = adminDataDeleteResponseSchema.parse({
        action: "anonymized",
        userId: subject.id,
        occurredAt,
      });
    } else {
      await prisma.user.delete({ where: { id: subject.id } });
      response = adminDataDeleteResponseSchema.parse({
        action: "deleted",
        userId: subject.id,
        occurredAt,
      });
    }

    await securityLogger({
      event: "data_delete",
      orgId: body.orgId,
      principal: principal.id,
      subjectUserId: subject.id,
      mode: response.action,
    });

    return reply.code(202).send(response);
  });
}

function parseAuthorization(request: FastifyRequest): Principal | null {
  const header = request.headers["authorization"] ?? request.headers["Authorization" as keyof typeof request.headers];
  if (!header || typeof header !== "string") {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return null;
  }

  const token = match[1];
  const [role, principalId, orgId] = token.split(":");
  if (!role || !principalId || !orgId) {
    return null;
  }

  return {
    id: principalId,
    role,
    orgId,
    token,
  };
}

async function detectForeignKeyRisk(
  prisma: PrismaClientLike,
  userId: string,
  email: string,
  orgId: string
): Promise<boolean> {
  const relatedLines = await prisma.bankLine.count({
    where: {
      orgId,
      payee: email,
    },
  });

  if (relatedLines > 0) {
    return true;
  }

  const otherRefs = await prisma.bankLine.count({
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

let cachedDefaultPrisma: PrismaClientLike | null = null;

async function getDefaultPrisma(): Promise<PrismaClientLike> {
  if (!cachedDefaultPrisma) {
    const module = (await import("../../../../shared/src/db.js")) as SharedDbModule;
    cachedDefaultPrisma = module.prisma;
  }
  return cachedDefaultPrisma;
}

export type { AdminDataDeleteRequest, AdminDataDeleteResponse };
=======
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

    log({
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
        createdAt: userRecord.createdAt.toISOString(),
      },
      relationships: {
        bankLinesCount,
      },
      exportedAt,
    };

    const validated = subjectDataExportResponseSchema.parse(responsePayload);

    return reply.send(validated);
  });
};

export default adminDataRoutes;
>>>>>>> origin/codex/add-admin-gated-subject-data-export-endpoint

