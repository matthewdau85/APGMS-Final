import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";

type RiskLevel = "low" | "medium" | "high";

export interface DeviceRiskScore {
  level: RiskLevel;
  fingerprint: string;
  signals: string[];
}

const knownDevices = new Map<string, Set<string>>();

function resolveIp(request: FastifyRequest): string {
  const header = request.headers["x-forwarded-for"];
  if (typeof header === "string" && header.trim().length > 0) {
    return header.split(",")[0]!.trim();
  }
  return request.ip;
}

function buildFingerprint(userId: string, request: FastifyRequest): string {
  const ua = (request.headers["user-agent"] ?? "unknown") as string;
  const ip = resolveIp(request);
  const raw = `${userId}|${ua}|${ip}`;
  return createHash("sha256").update(raw).digest("hex");
}

export function scoreDeviceRisk(
  userId: string,
  request: FastifyRequest,
  options: { mfaEnabled: boolean },
): DeviceRiskScore {
  const signals: string[] = [];
  const fingerprint = buildFingerprint(userId, request);
  const ua = (request.headers["user-agent"] ?? "unknown") as string;
  const ip = resolveIp(request);

  if (!ua || ua === "unknown") {
    signals.push("missing_user_agent");
  }
  if (!options.mfaEnabled) {
    signals.push("mfa_disabled");
  }
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) {
    signals.push("private_ip");
  }

  let level: RiskLevel = "low";
  if (!knownDevices.get(userId)?.has(fingerprint)) {
    signals.push("new_device");
    level = "medium";
  }

  if (signals.includes("mfa_disabled") && signals.includes("new_device")) {
    level = "high";
  }

  if (!knownDevices.has(userId)) {
    knownDevices.set(userId, new Set([fingerprint]));
  } else {
    knownDevices.get(userId)!.add(fingerprint);
  }

  return { level, fingerprint, signals };
}

export function clearKnownDevices(userId: string): void {
  knownDevices.delete(userId);
}
