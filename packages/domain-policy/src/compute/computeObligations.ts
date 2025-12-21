// packages/domain-policy/src/compute/computeObligations.ts

export interface ComputeObligationsInput {
  taxSpec: unknown;
  inputs: unknown;
}

export function computeObligations(input: ComputeObligationsInput) {
  if (!input.taxSpec) {
    throw new Error("Tax spec missing");
  }

  // Stubbed for now — real execution wired later
  return {
    status: "OK",
  };
}
