import { createVerify } from "node:crypto";

import type { SignedPayload } from "../types.js";

export interface SignatureVerifierOptions {
  publicCertificate: string;
  algorithm?: string;
}

export class SignatureVerifier {
  private readonly options: Required<SignatureVerifierOptions>;

  constructor(options: SignatureVerifierOptions) {
    this.options = {
      algorithm: "RSA-SHA256",
      ...options,
    } as Required<SignatureVerifierOptions>;
  }

  verify(message: SignedPayload): boolean {
    const verifier = createVerify(this.options.algorithm);
    const canonicalPayload = this.canonicalisePayload(message);
    verifier.update(canonicalPayload);
    verifier.end();

    const signatureBuffer = Buffer.from(message.signature, "base64");
    return verifier.verify(this.options.publicCertificate, signatureBuffer);
  }

  private canonicalisePayload(message: SignedPayload): string {
    const serialisedPayload =
      typeof message.payload === "string" ? message.payload : JSON.stringify(message.payload);

    const components = [
      message.id,
      message.issuedAt,
      message.signatureHeader ?? "",
      serialisedPayload,
    ];

    return components.join("\n");
  }
}

