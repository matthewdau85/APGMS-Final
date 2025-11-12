declare module "@apgms/shared/pii" {
  export interface MaskingOptions {
    additionalKeys?: readonly string[];
  }

  export function maskCollection<T>(values: readonly T[], options?: MaskingOptions): T[];
  export function maskIncidentLike<T extends Record<string, unknown>>(
    record: T,
    options?: MaskingOptions
  ): T;
}
