import "dotenv/config";

import type { EventBusConfig } from "./event-bus.js";

export interface AppConfig {
  port: number;
  host: string;
  modelPath: string;
  eventBus: EventBusConfig;
  serviceName: string;
  anomalySubject: string;
  schemaVersion: string;
}

function readNumber(envValue: string | undefined, fallback: number): number {
  if (!envValue) {
    return fallback;
  }
  const parsed = Number(envValue);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value: ${envValue}`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  const port = readNumber(process.env.PORT, 3005);
  const host = process.env.HOST ?? "0.0.0.0";
  const modelPath = process.env.MODEL_PATH ?? new URL("../model/anomaly_model.json", import.meta.url).pathname;

  const busMode = (process.env.EVENT_BUS_MODE ?? "in-memory") as "in-memory" | "nats";

  const eventBus: EventBusConfig =
    busMode === "nats"
      ? {
          mode: "nats",
          natsUrl: process.env.NATS_URL,
          natsStream: process.env.NATS_STREAM ?? "apgms_ml_events",
          natsSubjectPrefix: process.env.NATS_SUBJECT_PREFIX ?? "ml",
          connectionName: process.env.NATS_CONNECTION_NAME,
        }
      : { mode: "in-memory" };

  return {
    port,
    host,
    modelPath,
    eventBus,
    serviceName: process.env.SERVICE_NAME ?? "apgms-ml-inference",
    anomalySubject: process.env.ANOMALY_SUBJECT ?? "ml.anomaly.detected",
    schemaVersion: process.env.SCHEMA_VERSION ?? "1.0.0",
  };
}
