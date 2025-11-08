import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

import { ReconciliationService } from "./service.js";

const protoPath = resolve(dirname(fileURLToPath(import.meta.url)), "proto", "reconciliation.proto");
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  recon: {
    ReconciliationService: grpc.ServiceClientConstructor & {
      service: grpc.ServiceDefinition;
    };
  };
};

type GrpcServer = grpc.Server;

type GrpcCall = grpc.ServerUnaryCall<{ org_id: string; artifact_id?: string }, unknown>;

type GrpcCallback = grpc.sendUnaryData<unknown>;

export function createGrpcServer(
  service: ReconciliationService,
  port: number,
): Promise<{ server: GrpcServer; address: string }> {
  const server = new grpc.Server();

  server.addService(loaded.recon.ReconciliationService.service, {
    RunInference: async (call: GrpcCall, callback: GrpcCallback) => {
      try {
        const response = await service.runInference(call.request.org_id, call.request.artifact_id, "grpc");
        callback(null, {
          artifact_id: response.artifactId,
          generated_at: response.generatedAt,
          model_version: response.modelVersion,
          risk_score: response.riskScore,
          confidence: response.confidence,
          decision: response.decision === "REVIEW" ? "DECISION_REVIEW" : "DECISION_CLEAR",
          fallback_recommended: response.fallbackRecommended,
          drift: response.driftSignals.map((signal) => ({
            feature: signal.feature,
            score: signal.score,
            threshold: signal.threshold,
          })),
        });
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : "Inference failed",
        } as grpc.ServiceError, null);
      }
    },
  });

  const bindAddress = `0.0.0.0:${port}`;
  return new Promise((resolvePromise, rejectPromise) => {
    server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err, actualPort) => {
      if (err) {
        rejectPromise(err);
        return;
      }
      server.start();
      resolvePromise({ server, address: `0.0.0.0:${actualPort}` });
    });
  });
}
