import type { DeviceRiskLevel } from "./device-risk.js";

const PRIVILEGED_ROLES = new Set(["admin", "finance", "analyst", "auditor"]);

export interface MfaPolicyDecision {
  readonly enforced: boolean;
  readonly reason: string | null;
  readonly stepUpRequired: boolean;
}

export function evaluateMfaPolicy(
  role: string,
  hasMfa: boolean,
  deviceRisk: DeviceRiskLevel,
): MfaPolicyDecision {
  const privileged = PRIVILEGED_ROLES.has(role);
  if (privileged && !hasMfa) {
    return {
      enforced: true,
      reason: "privileged_role_requires_mfa",
      stepUpRequired: true,
    };
  }

  if (deviceRisk === "high") {
    return {
      enforced: true,
      reason: "device_risk_high",
      stepUpRequired: true,
    };
  }

  if (deviceRisk === "medium" && !hasMfa) {
    return {
      enforced: false,
      reason: "device_risk_medium_no_mfa",
      stepUpRequired: true,
    };
  }

  return {
    enforced: false,
    reason: null,
    stepUpRequired: deviceRisk !== "low",
  };
}
