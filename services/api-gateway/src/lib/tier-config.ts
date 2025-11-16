import fs from "node:fs";
import path from "node:path";

const complianceDir = path.join(process.cwd(), "artifacts", "compliance");
const tierConfigFile = path.join(complianceDir, "tier-tuning.json");
const scheduleStateFile = path.join(complianceDir, "tier-schedule.json");

export type TierScheduleConfig = {
  defaultFrequencyHours: number;
  orgOverrides: Record<string, number>;
};

export type TierTuningConfig = {
  marginPercent: number;
  schedule: TierScheduleConfig;
  updatedAt: string;
};

export type TierScheduleMetadata = {
  frequencyHours: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type TierScheduleState = {
  lastRun: Record<string, string>;
};

const defaultConfig: TierTuningConfig = {
  marginPercent: 0.1,
  schedule: { defaultFrequencyHours: 24, orgOverrides: {} },
  updatedAt: new Date(0).toISOString(),
};

function ensureComplianceDir() {
  fs.mkdirSync(complianceDir, { recursive: true });
}

function readJsonFile<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) {
    return fallback;
  }
  try {
    const text = fs.readFileSync(file, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(file: string, payload: unknown) {
  ensureComplianceDir();
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}

export function readTierTuningConfig(): TierTuningConfig {
  return readJsonFile(tierConfigFile, defaultConfig);
}

export function writeTierTuningConfig(update: Partial<{ marginPercent: number; schedule: Partial<TierScheduleConfig> }>) {
  const current = readTierTuningConfig();
  const next: TierTuningConfig = {
    marginPercent: update.marginPercent ?? current.marginPercent,
    schedule: {
      defaultFrequencyHours: update.schedule?.defaultFrequencyHours ?? current.schedule.defaultFrequencyHours,
      orgOverrides: {
        ...current.schedule.orgOverrides,
        ...(update.schedule?.orgOverrides ?? {}),
      },
    },
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(tierConfigFile, next);
  return next;
}

export function resolveTierMargin(): number {
  return readTierTuningConfig().marginPercent;
}

function resolveScheduleFrequency(orgId: string): number {
  const config = readTierTuningConfig();
  return config.schedule.orgOverrides[orgId] ?? config.schedule.defaultFrequencyHours;
}

function readScheduleState(): TierScheduleState {
  return readJsonFile(scheduleStateFile, { lastRun: {} });
}

function writeScheduleState(state: TierScheduleState) {
  writeJsonFile(scheduleStateFile, state);
}

export function getScheduleMetadata(orgId: string): TierScheduleMetadata {
  const state = readScheduleState();
  const frequencyHours = resolveScheduleFrequency(orgId);
  const lastRunAt = state.lastRun[orgId] ?? null;
  const nextRunAt = lastRunAt
    ? new Date(new Date(lastRunAt).getTime() + frequencyHours * 60 * 60 * 1000).toISOString()
    : null;
  return { frequencyHours, lastRunAt, nextRunAt };
}

export function recordScheduleRun(orgId: string, timestamp = new Date()): TierScheduleMetadata {
  const state = readScheduleState();
  state.lastRun[orgId] = timestamp.toISOString();
  writeScheduleState(state);
  return getScheduleMetadata(orgId);
}

export function shouldRunTierCheck(orgId: string, force = false): {
  run: boolean;
  reason?: string;
  schedule: TierScheduleMetadata;
} {
  const schedule = getScheduleMetadata(orgId);
  if (force) {
    return { run: true, schedule };
  }
  if (schedule.nextRunAt && Date.now() < Date.parse(schedule.nextRunAt)) {
    return { run: false, reason: "not_due", schedule };
  }
  return { run: true, schedule };
}
