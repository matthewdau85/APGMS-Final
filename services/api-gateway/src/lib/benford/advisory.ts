import type { TenantMetadata, TenantSettings } from "@apgms/shared/tenant-config";
import {
  getTenantMetadata,
  getTenantSettings,
} from "@apgms/shared/tenant-config";

export type AdvisoryContext = TenantMetadata & {
  showAtoContext: boolean;
};

export function resolveAdvisoryContext(
  tenantId: string,
  settingsOverride?: Partial<TenantSettings>,
): AdvisoryContext {
  const metadata = getTenantMetadata(tenantId);
  const settings = {
    ...getTenantSettings(tenantId),
    ...settingsOverride,
  };
  const showAtoContext = settings.showAtoContext ?? (metadata.region === "AU");
  return {
    tenantId: metadata.tenantId,
    region: metadata.region,
    locale: metadata.locale,
    showAtoContext,
  };
}

export function appendAtoContextDetail(
  details: readonly string[],
  context: AdvisoryContext,
  copy: { atoContextLine: string },
): string[] {
  if (!context.showAtoContext) {
    return [...details];
  }
  if (details.includes(copy.atoContextLine)) {
    return [...details];
  }
  return [...details, copy.atoContextLine];
}
