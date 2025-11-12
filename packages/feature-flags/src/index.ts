export type FeatureFlag = "detectorMuting";

export type FlagContext = {
  orgId?: string;
  tenantId?: string;
};

export interface FeatureFlagClient {
  isEnabled(flag: FeatureFlag, context?: FlagContext): boolean;
}

type DetectorMutingConfig = {
  enabled: boolean;
  orgAllowList: Set<string>;
};

type FeatureFlagConfig = {
  detectorMuting: DetectorMutingConfig;
};

const TRUTHY_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }
  return TRUTHY_VALUES.has(value.trim().toLowerCase());
};

const parseList = (value: string | undefined): Set<string> => {
  if (!value) {
    return new Set();
  }
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return new Set(entries);
};

const resolveOrgFromContext = (context?: FlagContext): string | undefined => {
  if (!context) {
    return undefined;
  }
  return context.orgId ?? context.tenantId;
};

const loadConfigFromEnv = (): FeatureFlagConfig => {
  const enabled = parseBoolean(process.env.FF_DETECTOR_MUTING, false);
  const orgAllowList = parseList(process.env.FF_DETECTOR_MUTING_ORGS);

  return {
    detectorMuting: {
      enabled,
      orgAllowList,
    },
  };
};

export const createFeatureFlagClient = (
  config: FeatureFlagConfig = loadConfigFromEnv(),
): FeatureFlagClient => ({
  isEnabled(flag, context) {
    switch (flag) {
      case "detectorMuting": {
        const detectorConfig = config.detectorMuting;
        if (!detectorConfig.enabled) {
          return false;
        }
        if (detectorConfig.orgAllowList.size === 0) {
          return true;
        }
        const orgId = resolveOrgFromContext(context);
        if (!orgId) {
          return false;
        }
        return detectorConfig.orgAllowList.has(orgId);
      }
      default:
        return false;
    }
  },
});

export type { FeatureFlagConfig };
