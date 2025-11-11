import { resolve } from "node:path";

const DEFAULT_MANIFEST_PATH = resolve(process.cwd(), "models/manifest.json");
const DEFAULT_SIGNATURE_PATH = `${DEFAULT_MANIFEST_PATH}.sig`;
const DEFAULT_PUBLIC_KEY_PATH = resolve(process.cwd(), "models/public.pem");

export interface ServiceConfig {
  readonly port: number;
  readonly host: string;
  readonly manifestPath: string;
  readonly manifestSignaturePath: string;
  readonly publicKeyPath: string;
  readonly driftWindow: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export const config: ServiceConfig = {
  port: intFromEnv("PORT", 4006),
  host: process.env.HOST ?? "0.0.0.0",
  manifestPath: process.env.MODEL_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH,
  manifestSignaturePath:
    process.env.MODEL_MANIFEST_SIGNATURE_PATH ?? DEFAULT_SIGNATURE_PATH,
  publicKeyPath: process.env.MODEL_PUBLIC_KEY_PATH ?? DEFAULT_PUBLIC_KEY_PATH,
  driftWindow: intFromEnv("MODEL_DRIFT_WINDOW", 500),
};
