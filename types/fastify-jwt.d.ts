declare module "@fastify/jwt" {
  import type { FastifyPluginCallback } from "fastify";

  export interface FastifyJWT {
    payload: any;
    user: any;
  }

  const fastifyJwt: FastifyPluginCallback;
  export default fastifyJwt;
}
