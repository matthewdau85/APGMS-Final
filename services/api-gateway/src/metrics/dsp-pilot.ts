import { Counter, Gauge, Histogram } from "prom-client";

export type DetectionResult = "true_positive" | "false_positive" | "false_negative";

const detectionOutcomes = new Counter({
  name: "dsp_pilot_detections_total",
  help: "DSP number pattern detection outcomes recorded during the pilot",
  labelNames: ["result"] as const,
});

const rolloutStatus = new Gauge({
  name: "dsp_pilot_rollout_status",
  help: "Feature flag activation status for the DSP pilot cohort (1 = enabled)",
  labelNames: ["cohort"] as const,
});

const precisionRatio = new Gauge({
  name: "dsp_pilot_precision_ratio",
  help: "Rolling precision ratio (true positives over total detections)",
});

const falsePositiveRatio = new Gauge({
  name: "dsp_pilot_false_positive_ratio",
  help: "Rolling false positive ratio for pilot detections",
});

const muteDurationHours = new Histogram({
  name: "dsp_pilot_mute_duration_hours",
  help: "Distribution of mute durations applied during the pilot in hours",
  buckets: [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 72],
});

const segmentationFreshness = new Gauge({
  name: "dsp_segmentation_freshness_ratio",
  help: "Proportion of pilot DSP entities refreshed within the last 24 hours",
});

const supportVolumeDelta = new Gauge({
  name: "dsp_support_volume_delta_ratio",
  help: "Support contact delta versus baseline for the pilot cohort",
});

const supportContacts = new Counter({
  name: "dsp_pilot_support_contacts_total",
  help: "Support contacts from the pilot cohort by channel",
  labelNames: ["channel"] as const,
});

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export const dspPilotMetrics = {
  detectionOutcomes,
  rolloutStatus,
  precisionRatio,
  falsePositiveRatio,
  muteDurationHours,
  segmentationFreshness,
  supportVolumeDelta,
  supportContacts,

  recordDetection(result: DetectionResult): void {
    detectionOutcomes.inc({ result });
  },

  setRolloutStatus(enabled: boolean, cohort = "pilot"): void {
    rolloutStatus.set({ cohort }, enabled ? 1 : 0);
  },

  setPrecision(ratio: number): void {
    precisionRatio.set(clampRatio(ratio));
  },

  setFalsePositiveRatio(ratio: number): void {
    falsePositiveRatio.set(clampRatio(ratio));
  },

  observeMuteDuration(hours: number): void {
    if (Number.isFinite(hours) && hours >= 0) {
      muteDurationHours.observe(hours);
    }
  },

  setSegmentationFreshness(ratio: number): void {
    segmentationFreshness.set(clampRatio(ratio));
  },

  setSupportVolumeDelta(ratio: number): void {
    supportVolumeDelta.set(clampRatio(ratio));
  },

  incSupportContact(channel: string): void {
    const safeChannel = channel && channel.length > 0 ? channel : "unknown";
    supportContacts.inc({ channel: safeChannel });
  },
};

dspPilotMetrics.setRolloutStatus(false);
dspPilotMetrics.setPrecision(0);
dspPilotMetrics.setFalsePositiveRatio(0);
dspPilotMetrics.setSegmentationFreshness(0);
dspPilotMetrics.setSupportVolumeDelta(0);
