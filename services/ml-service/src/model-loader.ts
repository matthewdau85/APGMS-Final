import { promises as fs } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createHash, createPublicKey, createVerify } from "node:crypto";

export type LogisticModel = {
  readonly id: string;
  readonly version: string;
  readonly type: "logistic_regression";
  readonly threshold: number;
  readonly bias: number;
  readonly coefficients: Record<string, number>;
  readonly explanations: Record<string, string>;
  readonly featureStats: Record<string, { mean: number; std: number }>;
};

export type LoadedModel = LogisticModel;

export type ModelRegistry = {
  readonly issuedAt: string;
  readonly models: Map<string, LoadedModel>;
};

type ManifestModelEntry = {
  id: string;
  version: string;
  path: string;
  sha256: string;
};

type Manifest = {
  issuedAt: string;
  models: ManifestModelEntry[];
};

async function verifySignature(
  payload: Buffer,
  signature: Buffer,
  publicKeyPem: string,
): Promise<boolean> {
  try {
    const publicKey = createPublicKey(publicKeyPem);
    const verify = createVerify("RSA-SHA256");
    verify.update(payload);
    verify.end();
    return verify.verify(publicKey, signature);
  } catch (error) {
    console.error("manifest_signature_verification_failed", error);
    return false;
  }
}

function validateModel(model: any, path: string): LoadedModel {
  if (!model || typeof model !== "object") {
    throw new Error(`Model at ${path} is not an object`);
  }

  if (model.type !== "logistic_regression") {
    throw new Error(`Model ${model.id ?? "unknown"} has unsupported type`);
  }

  const requiredProps: Array<keyof LogisticModel> = [
    "id",
    "version",
    "type",
    "threshold",
    "bias",
    "coefficients",
    "explanations",
    "featureStats",
  ];

  for (const prop of requiredProps) {
    if (!(prop in model)) {
      throw new Error(`Model ${model.id ?? "unknown"} missing property ${prop}`);
    }
  }

  return model as LoadedModel;
}

export async function loadModelRegistry(
  manifestPath: string,
  signaturePath: string,
  publicKeyPath: string,
): Promise<ModelRegistry> {
  const [manifestRaw, signatureRaw, publicKeyPem] = await Promise.all([
    fs.readFile(manifestPath),
    fs.readFile(signaturePath),
    fs.readFile(publicKeyPath, "utf8"),
  ]);

  const signature = signatureRaw.toString().trim().includes("---")
    ? Buffer.from(signatureRaw.toString())
    : Buffer.from(signatureRaw.toString().trim(), "base64");

  const valid = await verifySignature(manifestRaw, signature, publicKeyPem);
  if (!valid) {
    throw new Error("Model manifest signature invalid");
  }

  const manifest = JSON.parse(manifestRaw.toString("utf8")) as Manifest;

  if (!manifest.models || !Array.isArray(manifest.models)) {
    throw new Error("Manifest missing models array");
  }

  const baseDir = dirname(manifestPath);
  const models = new Map<string, LoadedModel>();

  for (const entry of manifest.models) {
    const modelPath = resolve(baseDir, entry.path);
    const file = await fs.readFile(modelPath);
    const sha256 = createHash("sha256").update(file).digest("hex");
    if (sha256 !== entry.sha256) {
      throw new Error(
        `Model ${entry.id} (${basename(entry.path)}) hash mismatch. expected ${entry.sha256}, got ${sha256}`,
      );
    }
    const parsed = JSON.parse(file.toString("utf8"));
    const validated = validateModel(parsed, entry.path);
    models.set(entry.id, validated);
  }

  return {
    issuedAt: manifest.issuedAt,
    models,
  };
}
