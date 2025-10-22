import pino from "pino";

export const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export function withRedaction(payload: any) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  if (clone.email) clone.email = "***redacted***";
  if (clone.phone) clone.phone = "***redacted***";
  if (clone.bsb) clone.bsb = "***";
  if (clone.account) clone.account = "****";
  return clone;
}
