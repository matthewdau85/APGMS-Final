// packages/domain-policy/test/no-hardcoded-au-rates.test.ts
import fs from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

describe("AU engines must be config-driven (no hard-coded rates/brackets)", () => {
  it("does not contain literal PAYGW/GST bracket tables in src/au-tax", () => {
    const root = path.resolve(process.cwd(), "src", "au-tax");
    const files = walk(root)
      .filter((f) => f.endsWith(".ts"))
      // ignore tests/fixtures if any live under src
      .filter((f) => !f.includes("__tests__") && !f.includes(".test.") && !f.includes("fixtures"));

    const banned = [
      /thresholdCents\s*:\s*\d+/,
      /baseWithholdingCents\s*:\s*\d+/,
      /marginalRateMilli\s*:\s*\d+/,
      /rateMilli\s*:\s*\d+/,
    ];

    const offenders: Array<{ file: string; match: string }> = [];

    for (const f of files) {
      const txt = fs.readFileSync(f, "utf8");
      for (const re of banned) {
        const m = txt.match(re);
        if (m) offenders.push({ file: f, match: m[0] });
      }
    }

    expect(offenders).toEqual([]);
  });
});
