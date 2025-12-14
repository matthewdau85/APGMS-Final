export type RiskDeleteInput = {
  orgId: string;
  userId: string;
  actor: string;
};

export type RiskDeleteResult =
  | {
      action: "ANONYMISED";
      reason: string;
    }
  | {
      action: "DELETED";
    };

export interface RiskDeleteStore {
  hasConstraints(input: RiskDeleteInput): Promise<boolean>;
}

export async function deleteUserWithRisk(
  store: RiskDeleteStore,
  input: RiskDeleteInput,
): Promise<RiskDeleteResult> {
  const constrained = await store.hasConstraints(input);

  if (constrained) {
    return {
      action: "ANONYMISED",
      reason: "Constraints present; retained records require anonymisation",
    };
  }

  return { action: "DELETED" };
}
