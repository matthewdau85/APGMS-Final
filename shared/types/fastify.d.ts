import "fastify";

declare module "fastify" {
  interface RequestFeatures {
    prototypeEnv: boolean;
    [featureName: string]: boolean | undefined;
  }

  interface FastifyRequest {
    features?: RequestFeatures;
  }
}
