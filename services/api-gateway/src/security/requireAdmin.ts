// ASCII only
import type { FastifyReply, FastifyRequest } from "fastify";

function getToken(req: FastifyRequest): string | null {
  const hdr = req.headers["x-admin-token"];
  if (typeof hdr === "string" && hdr.trim()) return hdr.trim();
  if (Array.isArray(hdr) && typeof hdr[0] === "string" && hdr[0].trim()) return hdr[0].trim();

  const auth = req.headers["authorization"];
  const authStr = typeof auth === "string" ? auth : Array.isArray(auth) ? auth[0] : undefined;
  if (authStr && authStr.toLowerCase().startsWith("bearer ")) {
    const t = authStr.slice(7).trim();
    if (t) return t;
  }
  return null;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expected = process.env.INTERNAL_ADMIN_TOKEN || process.env.ADMIN_TOKEN || "";
  const got = getToken(req) || "";

  if (!expected || got !== expected) {
    reply.code(403).send({ ok: false, error: { code: "admin_forbidden" } });
    return;
  }
}
