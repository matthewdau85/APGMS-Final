export type WormScope = "evidence" | "bank";

export type WormLockState = "pending" | "locked" | "unknown";

export type WormAttestation = {
  readonly providerId: string;
  readonly scope: WormScope;
  readonly uri: string;
  readonly sha256: string;
  readonly lockState: WormLockState;
  readonly retentionUntil: string | null;
};

export type WormAttestationInput = {
  readonly scope: WormScope;
  readonly sha256: string;
  readonly createdAt: Date;
  readonly retentionDays: number;
};

export interface WormProvider {
  readonly id: string;
  issueAttestation(input: WormAttestationInput): Promise<WormAttestation>;
  close(): Promise<void>;
}

export interface WormProviderOptions {
  readonly providerId: string;
  readonly evidenceRetentionDays: number;
  readonly bankRetentionDays: number;
  readonly s3?: {
    readonly bucket: string;
    readonly region: string;
    readonly objectLockMode?: string;
  };
  readonly gcs?: {
    readonly bucket: string;
    readonly location?: string;
  };
}

export const MILLIS_PER_DAY = 86_400_000;

export function createContentAddressedUri(scope: WormScope, sha256: string): string {
  return `apgms://${scope}/${sha256.toLowerCase()}`;
}
