import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authGuard } from "../auth.js";
import { withIdempotency } from "../lib/idempotency.js";

type Deps = {
  prisma?: any;
};

function tokenSetFromPrincipal(p: any): Set<string> {
  const out = new Set<string>();
  const push = (v: any) => {
    if (typeof v === "string" && v.trim() !== "") out.add(v.trim().toUpperCase());
    else if (Array.isArray(v)) for (const x of v) push(x);
  };

  if (!p || typeof p !== "object") return out;

  push(p.role);
  push(p.roles);
  push(p.permissions);
  push(p.scopes);

  for (const [k, v] of Object.entries(p)) {
    const kl = String(k).toLowerCase();
    if (kl.includes("role") || kl.includes("perm") || kl.includes("scope")) push(v);
  }

  return out;
}

function isForbidden(principal: any): boolean {
  const toks = tokenSetFromPrincipal(principal);
  for (const t of toks) {
    if (t.includes("VIEWER")) return true;
    if (t.includes("READONLY") || t.includes("READ_ONLY")) return true;
    if (t === "READ") return true;
  }
  return false;
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseAmountCents(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (t !== "" && /^-?\d+$/.test(t)) return parseInt(t, 10);
  }
  return null;
}

const BankLineBodySchema = z.object({
  idempotencyKey: z.string().min(1),
  amountCents: z.number().int(),
  orgId: z.string().min(1).optional(),
});

function resolveIdempotencyKey(req: any, body: any): string | undefined {
  const headerKey = String(req?.headers?.["idempotency-key"] ?? "").trim();
  if (headerKey) return headerKey;
  const bodyKey =
    typeof body?.idempotencyKey === "string"
      ? body.idempotencyKey.trim()
      : typeof body?.idempotency_key === "string"
      ? body.idempotency_key.trim()
      : typeof body?.key === "string"
      ? body.key.trim()
      : "";
  return bodyKey || undefined;
}

function hashPayload(payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
  return createHash("sha256").update(raw).digest("hex");
}

export function registerBankLinesRoutes(app: FastifyInstance, deps: Deps = {}): void {
  const prisma = deps.prisma ?? (app as any).db;

  app.post(
    "/bank-lines",
    { preHandler: authGuard as any },
    async (req: any, reply: any) => {
      const principal = (req as any).user ?? null;
      if (!principal) {
        return reply.code(401).send({ error: "unauthenticated" });
      }

      if (isForbidden(principal)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const tokenOrgId = String(principal.orgId ?? principal.org ?? "").trim();
      if (!tokenOrgId) {
        return reply.code(403).send({ error: "forbidden_org" });
      }

      const body: any = req.body ?? {};
      const idempotencyKey = resolveIdempotencyKey(req, body);
      const amountRaw = body.amountCents ?? body.amount_cents ?? body.amount;

      const headerOrgId = String(req.headers?.["x-org-id"] ?? "").trim() || undefined;
      const bodyOrgId =
        typeof body.orgId === "string" && body.orgId.trim().length > 0
          ? body.orgId.trim()
          : typeof body.org_id === "string" && body.org_id.trim().length > 0
          ? body.org_id.trim()
          : undefined;

      if (headerOrgId && bodyOrgId && headerOrgId !== bodyOrgId) {
        return reply.code(400).send({ error: "invalid_body", field: "orgId" });
      }

      const requestOrgId = headerOrgId ?? bodyOrgId;
      if (requestOrgId && requestOrgId !== tokenOrgId) {
        return reply.code(403).send({ error: "forbidden_org" });
      }

      const amountCents = parseAmountCents(amountRaw);
      const parsed = BankLineBodySchema.safeParse({
        idempotencyKey,
        amountCents,
        orgId: requestOrgId,
      });

      if (!parsed.success) {
        return reply.code(400).send({
          error: "invalid_body",
          details: parsed.error.flatten(),
        });
      }

      if (!prisma?.idempotencyEntry) {
        return reply.code(500).send({ error: "idempotency_unavailable" });
      }

      const requestPayload = {
        idempotencyKey,
        amountCents,
        orgId: requestOrgId ?? tokenOrgId,
      };
      const requestHash = hashPayload(requestPayload);

      const existing = await prisma.idempotencyEntry.findUnique({
        where: { orgId_key: { orgId: tokenOrgId, key: idempotencyKey } },
      });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          return reply.code(409).send({ error: "idempotency_conflict" });
        }

        if (existing.responsePayload != null && typeof existing.statusCode === "number") {
          reply.header("idempotent-replay", "true");
          return reply.code(existing.statusCode).send(existing.responsePayload);
        }

        return reply.code(409).send({ error: "idempotency_conflict" });
      }

      const result = await withIdempotency(
        { headers: { "idempotency-key": idempotencyKey } },
        reply,
        {
          prisma,
          orgId: tokenOrgId,
          actorId: String(principal.sub ?? principal.id ?? principal.email ?? "system"),
          requestPayload,
          resource: "bank-lines",
        },
        async () => {
          const payload = { status: "created", idempotencyKey, amountCents };
          return { statusCode: 201, body: payload, resource: "bank-lines" };
        }
      );

      reply.header("idempotent-replay", "false");
      return reply.code(result.statusCode).send(result.body);
    }
  );
}

export function createBankLinesPlugin(_deps: Deps = {}): FastifyPluginAsync {
  return async (app) => {
    registerBankLinesRoutes(app, _deps);
  };
}
