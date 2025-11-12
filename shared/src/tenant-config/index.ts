import { EventEmitter } from "node:events";

export type TenantRegion =
  | "AU"
  | "NZ"
  | "US"
  | "UK"
  | "EU"
  | "SG"
  | "CA"
  | string;

export interface TenantMetadata {
  tenantId: string;
  region: TenantRegion;
  locale: string;
}

export interface TenantSettings {
  showAtoContext?: boolean;
}

const DEFAULT_METADATA: TenantMetadata = {
  tenantId: "default",
  region: "AU",
  locale: "en-AU",
};

const metadataOverrides = new Map<string, Partial<TenantMetadata>>();
const tenantSettings = new Map<string, TenantSettings>();
const settingsEvents = new EventEmitter();

export function getTenantMetadata(tenantId: string): TenantMetadata {
  const override = metadataOverrides.get(tenantId);
  return {
    tenantId,
    region: override?.region ?? DEFAULT_METADATA.region,
    locale: override?.locale ?? DEFAULT_METADATA.locale,
  };
}

export function updateTenantMetadata(
  tenantId: string,
  metadata: Partial<Omit<TenantMetadata, "tenantId">>,
): TenantMetadata {
  const existing = metadataOverrides.get(tenantId) ?? {};
  const sanitizedEntries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null);
  const next = { ...existing, ...Object.fromEntries(sanitizedEntries) };
  metadataOverrides.set(tenantId, next);
  const resolved = getTenantMetadata(tenantId);
  settingsEvents.emit("metadata", { tenantId, metadata: resolved });
  return resolved;
}

export function getTenantSettings(tenantId: string): TenantSettings {
  return tenantSettings.get(tenantId) ?? {};
}

export function updateTenantSettings(
  tenantId: string,
  updates: TenantSettings,
): TenantSettings {
  const existing = tenantSettings.get(tenantId) ?? {};
  const next = { ...existing, ...updates };
  tenantSettings.set(tenantId, next);
  settingsEvents.emit("settings", { tenantId, settings: next });
  return next;
}

export function resetTenantConfiguration(tenantId?: string) {
  if (tenantId) {
    metadataOverrides.delete(tenantId);
    tenantSettings.delete(tenantId);
    settingsEvents.emit("reset", { tenantId });
    return;
  }
  metadataOverrides.clear();
  tenantSettings.clear();
  settingsEvents.emit("reset", { tenantId: null });
}

export function onTenantConfigurationChange(
  listener: (event: { tenantId: string | null; metadata?: TenantMetadata; settings?: TenantSettings }) => void,
) {
  const handler = (payload: any) => {
    listener(payload);
  };
  settingsEvents.on("metadata", handler);
  settingsEvents.on("settings", handler);
  settingsEvents.on("reset", handler);
  return () => {
    settingsEvents.off("metadata", handler);
    settingsEvents.off("settings", handler);
    settingsEvents.off("reset", handler);
  };
}
