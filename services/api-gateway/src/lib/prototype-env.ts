import type { FastifyReply } from "fastify";

function readPrototypeEnv(): string | undefined {
  const value = process.env.PROTOTYPE_ENV?.trim();
  return value && value.length > 0 ? value : undefined;
}

function hasAdminRole(roleInput: string | ReadonlyArray<string> | undefined): boolean {
  if (!roleInput) {
    return false;
  }
  const roles = Array.isArray(roleInput) ? roleInput : [roleInput];
  return roles.some((role) => role?.toLowerCase() === "admin");
}

export function includePrototypeEnv<T extends Record<string, unknown>>(
  reply: FastifyReply,
  payload: T,
  roleInput: string | ReadonlyArray<string> | undefined,
): T | (T & { prototypeEnv: string }) {
  const prototypeEnv = readPrototypeEnv();
  if (!prototypeEnv || !hasAdminRole(roleInput)) {
    return payload;
  }
  reply.header("x-prototype-env", prototypeEnv);
  return { ...payload, prototypeEnv } as T & { prototypeEnv: string };
}

export function currentPrototypeEnv(): string | undefined {
  return readPrototypeEnv();
}
