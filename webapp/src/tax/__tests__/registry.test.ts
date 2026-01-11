import { computeTax, listTaxTypes, registerPlugin } from "../registry";

describe("tax registry", () => {
  it("registers plugins, lists sorted tax types, and dispatches compute", async () => {
    const pluginA = {
      id: "TEST_REGISTRY_A",
      compute: async () => [{ id: "obl-a", type: "TEST_REGISTRY_A", amountCents: 100 }],
    };
    const pluginB = {
      id: "TEST_REGISTRY_B",
      compute: async () => [{ id: "obl-b", type: "TEST_REGISTRY_B", amountCents: 200 }],
    };

    registerPlugin(pluginB);
    registerPlugin(pluginA);

    const list = listTaxTypes();
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
    expect(list.indexOf(pluginA.id)).toBeLessThan(list.indexOf(pluginB.id));

    const resA = await computeTax(pluginA.id, { asAt: "2025-07-01" }, {});
    const resB = await computeTax(pluginB.id, { asAt: "2025-07-01" }, {});
    expect(resA[0].id).toBe("obl-a");
    expect(resB[0].id).toBe("obl-b");
  });
});
