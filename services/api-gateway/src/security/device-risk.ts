import crypto from "node:crypto";
import { EventEmitter } from "node:events";

export type DeviceRiskLevel = "low" | "medium" | "high";

export interface DeviceSignals {
  readonly deviceId?: string;
  readonly deviceFingerprint?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly platform?: string;
  readonly geo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
  };
  readonly anomalyScore?: number;
}

export interface DeviceRiskAssessment {
  readonly level: DeviceRiskLevel;
  readonly reasons: string[];
  readonly timestamp: Date;
}

type DeviceProfile = {
  readonly fingerprint: string;
  readonly firstSeen: Date;
  readonly lastSeen: Date;
  readonly signals: DeviceSignals;
  readonly riskLevel: DeviceRiskLevel;
};

export type DeviceRiskOptions = {
  readonly anomalyThreshold: number;
  readonly trustOnFirstUse: boolean;
};

const defaultOptions: DeviceRiskOptions = {
  anomalyThreshold: 0.65,
  trustOnFirstUse: false,
};

export const deviceRiskEvents = new EventEmitter();

type StoreKey = `${string}:${string}`;

const normaliseFingerprint = (signals: DeviceSignals): string | null => {
  if (signals.deviceFingerprint && signals.deviceFingerprint.trim().length >= 10) {
    return signals.deviceFingerprint.trim().toLowerCase();
  }
  if (signals.deviceId && signals.deviceId.trim().length >= 6) {
    return crypto.createHash("sha256").update(signals.deviceId.trim().toLowerCase()).digest("hex");
  }
  if (signals.userAgent) {
    const uaHash = crypto.createHash("sha256").update(signals.userAgent).digest("hex");
    return `${uaHash}:${signals.platform ?? "unknown"}`;
  }
  return null;
};

export class DeviceRiskService {
  private readonly profiles = new Map<StoreKey, DeviceProfile>();

  constructor(private options: DeviceRiskOptions = defaultOptions) {}

  updateOptions(options: Partial<DeviceRiskOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  assess(orgId: string, userId: string, signals: DeviceSignals): DeviceRiskAssessment {
    const fingerprint = normaliseFingerprint(signals);
    const key: StoreKey | null = fingerprint ? `${orgId}:${fingerprint}` : null;
    const now = new Date();
    const reasons: string[] = [];

    let level: DeviceRiskLevel = "low";

    if (!fingerprint) {
      level = "medium";
      reasons.push("missing_fingerprint");
    }

    const anomalyScore = typeof signals.anomalyScore === "number" ? signals.anomalyScore : 0;
    if (anomalyScore >= this.options.anomalyThreshold) {
      level = "high";
      reasons.push("anomaly_threshold_exceeded");
    }

    const profile = key ? this.profiles.get(key) : undefined;

    if (!profile) {
      if (!this.options.trustOnFirstUse) {
        level = "high";
        reasons.push("unknown_device");
      }
      if (key) {
        this.profiles.set(key, {
          fingerprint: fingerprint!,
          firstSeen: now,
          lastSeen: now,
          signals,
          riskLevel: level,
        });
      }
    } else {
      const hoursSinceLastSeen = (now.getTime() - profile.lastSeen.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSeen > 720) {
        level = "medium";
        reasons.push("device_dormant");
      }
      const geoChanged =
        signals.geo &&
        profile.signals.geo &&
        signals.geo.country &&
        profile.signals.geo.country &&
        signals.geo.country !== profile.signals.geo.country;
      if (geoChanged) {
        level = "high";
        reasons.push("geo_velocity");
      }

      this.profiles.set(key, {
        fingerprint: profile.fingerprint,
        firstSeen: profile.firstSeen,
        lastSeen: now,
        signals,
        riskLevel: level,
      });
    }

    if (level !== "low") {
      deviceRiskEvents.emit("risk", {
        orgId,
        userId,
        level,
        reasons,
        timestamp: now,
      });
    }

    return { level, reasons, timestamp: now };
  }
}

export const globalDeviceRiskService = new DeviceRiskService();
