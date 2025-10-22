import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  adminDataDeleteRequestSchema,
  adminDataDeleteResponseSchema,
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
  type AdminDataDeleteResponse,
} from "../schemas/admin.data";

const PASSWORD_PLACEHOLDER = "__deleted__";
const ADMIN_JWT_SECRET_ENV = "ADMIN_JWT_SECRET";

const adminJwtPayloadSchema = z.object({
  sub: z.string(),
  orgId: z.string(),
  role: z.string(),
  email: z.string().email().optional(),
});

interface Principal {
  id: string;
  role: string;
  orgId: string;
  email?: string;
}

type SharedDbModule = typeof import("../../../../shared/src/db.js");

type PrismaClientLike = {
  user: {
    findFirst: (args: {
      where: { orgId: string; email: string };
      select?: unknown;
    }) => Promise<
      | {
          id: string;
          email: string;
          orgId: string;
          password: string | null;
          createdAt: Date;
        }
      | null
    >;
    update: (args: {
      where: { id: string };
      data: { email: string; password: string };
    }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  bankLine: {
    count: (args: {
      where: { orgId: string; payee?: string; desc?: { contains: string } };
    }) => Promise<number>;
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

type SecurityLogPayload =
  | {
      event: "data_delete";
      orgId: string;
      principal: string;
      subjectUserId: string;
      mode: "anonymized" | "deleted";
    }
  | {
      event: "data_export";
      orgId: string;
      principal: string;
      subjectEmail: string;
    };

interface AdminDataRouteDeps {
  prisma?: PrismaClientLike;
  secLog?: (payload: SecurityLogPayload) => Promise<void> | void;
}

export async function registerAdminDataRoutes(
  app: FastifyInstance,
  deps: AdminDataRouteDeps = {}
) {
  const prisma =
    deps.prisma ??
    (typeof (app as any).hasDecorator === "function" &&
    (app as any).hasDecorator("db")
      ? ((app as any).db as PrismaClientLike)
      : ((app as any).db as PrismaClientLike | undefined)) ??
    (await getDefaultPrisma());
  const securityLogger =
    deps.secLog ??
    (typeof (app as any).hasDecorator === "function" &&
    (app as any).hasDecorator("secLog")
      ? ((app as any).secLog as (payload: SecurityLogPayload) =>
          Promise<void> | void)
      : ((app as any).secLog as
          | ((payload: SecurityLogPayload) => Promise<void> | void)
          | undefined)) ??
    (async (payload: SecurityLogPayload) => {
      app.log.info({ security: payload }, "security_event");
    });

  app.post("/admin/data/delete", async (request, reply) => {
    const principal = await requireAdminPrincipal(request, reply);
    if (!principal) {
      return;
    }

    const parsed = adminDataDeleteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

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
          password: PASSWORD_PLACEHOLDER,
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

  app.post("/admin/data/export", async (request, reply) => {
    const principal = await requireAdminPrincipal(request, reply);
    if (!principal) {
      return;
    }

    const parsed = subjectDataExportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = parsed.data;

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const userRecord = await prisma.user.findFirst({
      where: { email: body.email, orgId: body.orgId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
    } as any);

    if (!userRecord) {
      return reply.code(404).send({ error: "not_found" });
    }

    const bankLinesCount = await prisma.bankLine.count({
      where: { orgId: body.orgId },
    });

    const exportedAt = new Date().toISOString();

    if (prisma.accessLog?.create) {
      await prisma.accessLog.create({
        data: {
          event: "data_export",
          orgId: body.orgId,
          principalId: principal.id,
          subjectEmail: body.email,
        },
      });
    }

    await securityLogger({
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
}

async function requireAdminPrincipal(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<Principal | null> {
  const principal = await authenticatePrincipal(request, reply);
  if (!principal) {
    return null;
  }

  if (principal.role !== "admin") {
    await reply.code(403).send({ error: "forbidden" });
    return null;
  }

  return principal;
}

async function authenticatePrincipal(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<Principal | null> {
  const secret = process.env[ADMIN_JWT_SECRET_ENV];

  if (!secret) {
    request.log.error(`${ADMIN_JWT_SECRET_ENV} is not configured`);
    await reply.code(500).send({ error: "admin_auth_config_missing" });
    return null;
  }

  const header = request.headers.authorization ??
    request.headers["Authorization" as keyof typeof request.headers];
  if (!header || typeof header !== "string") {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  try {
    const payload = verifyJwt(match[1], secret);

    if (!payload) {
      await reply.code(401).send({ error: "unauthorized" });
      return null;
    }

    const parsed = adminJwtPayloadSchema.safeParse({
      ...payload,
      sub: payload.sub,
    });

    if (!parsed.success) {
      await reply.code(401).send({ error: "unauthorized" });
      return null;
    }

    return {
      id: parsed.data.sub,
      orgId: parsed.data.orgId,
      role: parsed.data.role,
      email: parsed.data.email,
    };
  } catch (error) {
    request.log.warn({ err: error }, "failed to verify admin token");
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
}

function verifyJwt(token: string, secret: string): Record<string, any> | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;

  let signatureBuffer: Buffer;
  let expectedSignature: Buffer;

  try {
    signatureBuffer = Buffer.from(signatureSegment, "base64url");
  } catch {
    return null;
  }

  const data = `${headerSegment}.${payloadSegment}`;
  try {
    expectedSignature = createHmac("sha256", secret)
      .update(data)
      .digest();
  } catch {
    return null;
  }

  if (
    expectedSignature.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedSignature, signatureBuffer)
  ) {
    return null;
  }

  try {
    const headerJson = Buffer.from(headerSegment, "base64url").toString("utf8");
    const header = JSON.parse(headerJson);
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    const payloadJson = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as Record<string, any>;
    if (typeof payload.sub !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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

export type { AdminDataDeleteResponse };

export default registerAdminDataRoutes;
