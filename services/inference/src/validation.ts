import type {
  InferenceFeatureVector,
  InferenceRequestBody,
} from "@apgms/shared";

class ValidationError extends Error {
  public readonly code = "invalid_request" as const;
}

export function parseRequestBody(raw: unknown): InferenceRequestBody {
  if (typeof raw !== "object" || raw === null) {
    throw new ValidationError("Request body must be an object");
  }

  const candidate = raw as Partial<InferenceRequestBody>;
  const requestId = coerceString(candidate.requestId, "requestId");
  const orgId = coerceString(candidate.orgId, "orgId");
  validateFeatures(candidate.features);

  return {
    requestId,
    orgId,
    features: candidate.features!,
    requestedAt:
      typeof candidate.requestedAt === "string" && candidate.requestedAt.length > 0
        ? candidate.requestedAt
        : undefined,
    context: typeof candidate.context === "object" && candidate.context !== null ? candidate.context : undefined,
  };
}

export function validateFeatures(features: unknown): asserts features is InferenceFeatureVector {
  if (typeof features !== "object" || features === null) {
    throw new ValidationError("features must be an object");
  }

  const candidate = features as Partial<InferenceFeatureVector>;
  for (const key of FEATURE_KEYS) {
    const value = candidate[key];
    if (!isFiniteNumber(value)) {
      throw new ValidationError(`${String(key)} must be a finite number`);
    }
  }
}

function coerceString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const FEATURE_KEYS: Array<keyof InferenceFeatureVector> = [
  "payrollVariance",
  "reconciliationLagDays",
  "transactionVolume",
  "alertDensity",
];

export { ValidationError };
