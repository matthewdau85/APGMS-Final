export type ServiceMode = "normal" | "read-only" | "suspended";

export interface ServiceModeState {
  mode: ServiceMode;
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
}

let state: ServiceModeState = {
  mode: "normal",
  updatedAt: new Date().toISOString(),
  updatedBy: "boot",
};

export function getServiceMode(): ServiceModeState {
  return { ...state };
}

export function setServiceMode(
  mode: ServiceMode,
  meta?: { by?: string; reason?: string }
): ServiceModeState {
  state = {
    mode,
    updatedAt: new Date().toISOString(),
    updatedBy: meta?.by,
    reason: meta?.reason,
  };
  return getServiceMode();
}

// Test helper (do not use in production code paths)
export function _resetServiceModeForTests(): void {
  state = {
    mode: "normal",
    updatedAt: new Date().toISOString(),
    updatedBy: "test-reset",
  };
}
