import { deleteUserWithRisk } from "../src/operations/risk/safe-delete.js";

describe("deleteUserWithRisk", () => {
  it("anonymises when constrained", async () => {
    const calls: string[] = [];
    const store = {
      hasConstraints: async () => true,
      anonymiseUser: async () => calls.push("anonymise"),
      hardDeleteUser: async () => calls.push("hardDelete"),
    };

    const out = await deleteUserWithRisk(store, "u1");
    expect(out.action).toBe("ANONYMISED");
    expect(calls).toEqual(["anonymise"]);
  });

  it("hard deletes when not constrained", async () => {
    const calls: string[] = [];
    const store = {
      hasConstraints: async () => false,
      anonymiseUser: async () => calls.push("anonymise"),
      hardDeleteUser: async () => calls.push("hardDelete"),
    };

    const out = await deleteUserWithRisk(store, "u1");
    expect(out.action).toBe("HARD_DELETED");
    expect(calls).toEqual(["hardDelete"]);
  });
});
