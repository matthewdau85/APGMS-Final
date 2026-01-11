import { protoApi } from "../../prototype/protoApi";
import { listTaxTypes } from "../registry";
import { registerAllTaxPlugins } from "../plugins/registerAll";

function ensureLocalStorage() {
  if (globalThis.localStorage) return;

  let length = 0;
  const store = new Map<string, string>();

  const localStorageMock: Storage = {
    get length() {
      return length;
    },
    clear() {
      store.clear();
      length = 0;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      if (store.delete(key)) {
        length = store.size;
      }
    },
    setItem(key: string, value: string) {
      store.set(key, value);
      length = store.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
}

describe("protoApi compute", () => {
  it("registers plugins and returns obligations with evidence", async () => {
    ensureLocalStorage();
    if (!listTaxTypes().includes("AU_PAYGW")) {
      registerAllTaxPlugins();
    }

    const res = await protoApi.computePaygw({
      payPeriod: "WEEKLY",
      grossIncomeMinor: 10_000_00,
      taxFileNumberProvided: true,
      asAt: "2025-07-01",
    });

    const evidence = (res[0] as { evidenceRef?: { generatedAtUtc?: string } }).evidenceRef;
    expect(evidence?.generatedAtUtc).toBeTruthy();
  });
});
