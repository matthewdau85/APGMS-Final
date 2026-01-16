import { createTwoFilesPatch } from "diff";

export function unifiedSampleDiff(oldText: string, newText: string, maxLines = 120): {
  sample: string;
  added: number;
  removed: number;
  changed: number;
} {
  const patch = createTwoFilesPatch("prev", "curr", oldText, newText, "", "", { context: 2 });
  const lines = patch.split("\n");

  let added = 0,
    removed = 0,
    changed = 0;
  for (const l of lines) {
    if (l.startsWith("+") && !l.startsWith("+++")) added++;
    else if (l.startsWith("-") && !l.startsWith("---")) removed++;
  }
  changed = Math.max(added, removed);

  const sample = lines.slice(0, maxLines).join("\n");
  return { sample, added, removed, changed };
}
