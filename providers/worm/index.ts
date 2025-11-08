import { GcsBucketLockProvider } from "./gcs.js";
import { InternalWormProvider } from "./internal.js";
import { S3ObjectLockProvider } from "./s3.js";
import type { WormProvider, WormProviderOptions, WormScope } from "./types.js";

export * from "./types.js";

export function createWormProvider(options: WormProviderOptions): WormProvider {
  const providerId = options.providerId.toLowerCase();
  switch (providerId) {
    case "s3":
    case "s3-object-lock":
      if (!options.s3) {
        throw new Error("S3 provider selected without configuration");
      }
      return new S3ObjectLockProvider(options.s3);
    case "gcs":
    case "gcs-bucket-lock":
      if (!options.gcs) {
        throw new Error("GCS provider selected without configuration");
      }
      return new GcsBucketLockProvider(options.gcs);
    case "internal":
    case "memory":
    default:
      return new InternalWormProvider();
  }
}

export function resolveScopeForKind(kind: string): WormScope {
  if (kind.toLowerCase().includes("designated")) {
    return "bank";
  }
  return "evidence";
}
