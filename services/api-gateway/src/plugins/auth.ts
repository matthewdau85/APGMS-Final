import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  authenticateRequest as coreAuthenticateRequest,
  type Principal,
  type Role,
} from "@apgms/auth";

export type { Role } from "@apgms/auth";
export type AuthenticatedUser = Principal;

export function buildAuthPreHandler(
  app: FastifyInstance,
  roles: ReadonlyArray<Role> = [],
) {
  return async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<Principal | null> {
    return authenticateRequest(app, request, reply, roles);
  };
}

export async function authenticateRequest(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  roles: ReadonlyArray<Role> = [],
): Promise<Principal | null> {
  const principal = await coreAuthenticateRequest(app, request, reply, roles);
  if (principal) {
    (request as any).user = principal;
  } else {
    delete (request as any).user;
  }
  return principal;
}

export default authenticateRequest;
