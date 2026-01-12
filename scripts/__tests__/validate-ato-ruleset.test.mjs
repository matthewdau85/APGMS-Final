import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  MemoryConfigStore,
  selectEffectiveDate,
  validateConfigCompleteness,
  validateSpecAgainstSchema,
} from "../validate-ato-ruleset.mjs";

const SPEC_PATH = path.resolve("specs", "ato", "ato-ruleset.v1.json");
const SCHEMA_PATH = path.resolve("specs", "ato", "ato-ruleset.schema.v1.json");
const SPEC = JSON.parse(await readFile(SPEC_PATH, "utf8"));
const SCHEMA = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));

describe("ATO ruleset validator helpers", () => {
  it("fails schema validation for invalid specs", () => {
    assert.throws(() => {
      validateSpecAgainstSchema({ spec_version: "v1" }, SCHEMA);
    }, /required/);
  });

  it("detects missing paygw tables", async () => {
    const effective = selectEffectiveDate(SPEC, "2024-2025");
    const store = new MemoryConfigStore({
      paygwTables: ["paygw_brackets_weekly"],
      gstCategories: Object.keys(SPEC.gst.category_map),
      basRules: SPEC.bas.due_date_rules,
    });
    const errors = await validateConfigCompleteness({ spec: SPEC, effective, store });
    assert.ok(
      errors.some((msg) => msg.includes("paygw_brackets_fortnightly")),
      "Expected missing fortnightly table error"
    );
  });

  it("passes when all config pieces exist", async () => {
    const effective = selectEffectiveDate(SPEC, "2024-2025");
    const store = new MemoryConfigStore({
      paygwTables: [
        "paygw_brackets_weekly",
        "paygw_brackets_fortnightly",
        "paygw_brackets_monthly",
      ],
      gstCategories: Object.keys(SPEC.gst.category_map),
      basRules: SPEC.bas.due_date_rules,
    });
    const errors = await validateConfigCompleteness({ spec: SPEC, effective, store });
    assert.deepStrictEqual(errors, []);
  });
});
