import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultModelDir = resolve(moduleDir, "../../..", "artifacts", "models", "reconciliation");

export type ReconConfig = {
  serviceName: string;
  httpPort: number;
  grpcPort: number;
  modelDirectory: string;
  databaseUrl: string;
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export const config: ReconConfig = {
  serviceName: process.env.RECON_SERVICE_NAME ?? "reconciliation-service",
  httpPort: Number.parseInt(process.env.RECON_HTTP_PORT ?? "7100", 10),
  grpcPort: Number.parseInt(process.env.RECON_GRPC_PORT ?? "50061", 10),
  modelDirectory: process.env.RECON_MODEL_DIR ?? defaultModelDir,
  databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL),
};
