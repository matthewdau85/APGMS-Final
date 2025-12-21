// packages/domain-policy/src/compute/computeObligations.ts

export interface ComputeInput {
  taxSpec: unknown;
  inputs: unknown;
}

export function computeObligations(input: ComputeInput) {
  if (!input.taxSpec) {
    throw new Error("Tax spec missing");
  }

  // placeholder for future conflict detection
  if (Array.isArray(input.taxSpec)) {
    throw new Error("Tax spec conflict: multiple active specs");
  }

  // Not implemented yet — but deterministic failure
  throw new Error("Compute engine not yet implemented");
}