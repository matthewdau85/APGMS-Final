import { InternalWormProvider } from "./internal.js";
import type { WormAttestationInput, WormAttestation } from "./types.js";

type GcsOptions = {
  readonly bucket: string;
  readonly location?: string;
};

export class GcsBucketLockProvider extends InternalWormProvider {
  private readonly options: GcsOptions;

  constructor(options: GcsOptions) {
    super("gcs-bucket-lock");
    this.options = options;
  }

  override async issueAttestation(input: WormAttestationInput): Promise<WormAttestation> {
    const attestation = await super.issueAttestation(input);
    return {
      ...attestation,
      providerId: `${this.id}:${this.options.bucket}:${this.options.location ?? "multi"}`,
    };
  }
}
