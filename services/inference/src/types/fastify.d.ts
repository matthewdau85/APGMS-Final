import type { InferenceEngine } from "../model/engine.js";
import type { NatsBus } from "@apgms/shared";

declare module "fastify" {
  interface FastifyInstance {
    inferenceEngine: InferenceEngine;
    inferenceNats?: NatsBus;
  }
}
