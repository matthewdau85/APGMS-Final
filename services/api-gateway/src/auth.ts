// services/api-gateway/src/auth.ts
import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ pull from env directly instead of importing ./config
const AUD = process.env.AUTH_AUDIENCE!;
const ISS = process.env.AUTH_ISSUER!;
const SECRET = process.env.AUTH_DEV_SECRET!; // HS256 key

export function signToken(user: {
  id: string;
  orgId: string;
  role?: string;
}) {
  return jwt.sign(
    {
      sub: user.id,
      orgId: user.orgId,
      role: user.role ?? "admin",
      aud: AUD,
      iss: ISS,
    },
    SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );
}

export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Missing bearer token" },
    });
    return;
  }

  const token = header.substring("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ["HS256"],
      audience: AUD,
      issuer: ISS,
    });

    (request as any).user = decoded;
  } catch {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Invalid token" },
    });
  }
}

export async function verifyCredentials(
  email: string,
  pw: string
) {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) return null;

  const ok = await bcrypt.compare(pw, user.password);
  if (!ok) return null;

  return user;
}
