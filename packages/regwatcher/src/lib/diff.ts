import { diffLines } from "diff";
export function diffText(a: string, b: string): string {
  const parts = diffLines(a, b);
  let out = "";
  for (const p of parts) {
    const prefix = p.added ? "+" : p.removed ? "-" : " ";
    const lines = p.value.replace(/\r/g, "").split("\n");
    for (const L of lines) { if (!L) continue; out += prefix + L + "\n"; }
  }
  return out;
}
