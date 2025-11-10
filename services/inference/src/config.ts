import { ensureNumber } from "./utils/ensure-number.js";

export interface NatsConfig {
  url: string;
  stream: string;
  subjectPrefix: string;
  durableName: string;
}

export interface ServiceConfig {
  port: number;
  host: string;
  threshold: number;
  nats?: NatsConfig;
}

export const config: ServiceConfig = {
  port: Number(process.env.PORT ?? 3100),
  host: process.env.HOST ?? "0.0.0.0",
  threshold: ensureNumber(process.env.INFERENCE_ALERT_THRESHOLD ?? "0.7", 0.7),
  nats: process.env.NATS_URL
    ? {
        url: process.env.NATS_URL,
        stream: process.env.NATS_STREAM ?? "APGMS",
        subjectPrefix: process.env.NATS_SUBJECT_PREFIX ?? "apgms.dev",
        durableName: process.env.NATS_INFERENCE_DURABLE ?? "inference-worker",
      }
    : undefined,
};
