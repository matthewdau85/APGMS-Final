export type DeleteOutcome =
  | { action: "ANONYMISED"; reason: string }
  | { action: "HARD_DELETED"; reason: string };

export type RiskDeleteStore = {
  hasConstraints(userId: string): Promise<boolean>;
  anonymiseUser(userId: string): Promise<void>;
  hardDeleteUser(userId: string): Promise<void>;
};

export async function deleteUserWithRisk(store: RiskDeleteStore, userId: string): Promise<DeleteOutcome> {
  const constrained = await store.hasConstraints(userId);

  if (constrained) {
    await store.anonymiseUser(userId);
    return { action: "ANONYMISED", reason: "Constraints present; retained records require anonymisation" };
  }

  await store.hardDeleteUser(userId);
  return { action: "HARD_DELETED", reason: "No constraints detected; hard delete permitted" };
}
