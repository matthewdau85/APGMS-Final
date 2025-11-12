export declare const DETECTOR_MUTE_SCOPES: readonly ["TENANT", "STREAM", "PERIOD"];
export type DetectorMuteScope = (typeof DETECTOR_MUTE_SCOPES)[number];

export declare const DETECTOR_MUTE_REASONS: readonly [
  "NONE",
  "TENANT_MUTED",
  "STREAM_MUTED",
  "PERIOD_MUTED",
  "EXPIRED"
];
export type DetectorMuteReason = (typeof DETECTOR_MUTE_REASONS)[number];
