import { InternalWormProvider } from "./internal.js";
import type { WormAttestationInput, WormAttestation } from "./types.js";

type S3Options = {
  readonly bucket: string;
  readonly region: string;
  readonly objectLockMode?: string;
};

export class S3ObjectLockProvider extends InternalWormProvider {
  private readonly options: S3Options;

  constructor(options: S3Options) {
    super("s3-object-lock");
    this.options = options;
  }

  override async issueAttestation(input: WormAttestationInput): Promise<WormAttestation> {
    const attestation = await super.issueAttestation(input);
    return {
      ...attestation,
      providerId: `${this.id}:${this.options.bucket}:${this.options.region}`,
    };
  }
}
