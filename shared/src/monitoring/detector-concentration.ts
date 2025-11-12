export type DetectorFlaggedRow = {
  vendor?: string | null;
  approver?: string | null;
};

export type ConcentrationEntry = {
  name: string;
  count: number;
  percentage: number;
};

export type DetectorConcentration = {
  totalFlagged: number;
  vendorShare: ConcentrationEntry[];
  approverShare: ConcentrationEntry[];
};

export type AggregateDetectorOptions = {
  limit?: number;
};

const DEFAULT_LIMIT = 5;

function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

type ShareCounter = Map<string, { name: string; count: number }>;

function buildShareMap(entries: Array<string | null | undefined>): ShareCounter {
  const counts: ShareCounter = new Map();
  for (const entry of entries) {
    if (!entry) continue;
    const trimmed = normaliseName(entry);
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("en-AU");
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { name: trimmed, count: 1 });
    }
  }
  return counts;
}

function toConcentrationEntries(
  counts: ShareCounter,
  total: number,
  limit: number,
): ConcentrationEntry[] {
  if (total === 0 || counts.size === 0) {
    return [];
  }

  const entries = Array.from(counts.values())
    .map(({ name, count }) => ({
      name,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return a.name.localeCompare(b.name);
    });

  return entries.slice(0, Math.max(1, limit));
}

export function aggregateDetectorConcentration(
  rows: DetectorFlaggedRow[],
  options: AggregateDetectorOptions = {},
): DetectorConcentration {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : DEFAULT_LIMIT;
  const totalFlagged = rows.length;

  const vendorCounts = buildShareMap(rows.map((row) => row.vendor ?? null));
  const approverCounts = buildShareMap(rows.map((row) => row.approver ?? null));

  return {
    totalFlagged,
    vendorShare: toConcentrationEntries(vendorCounts, totalFlagged, safeLimit),
    approverShare: toConcentrationEntries(approverCounts, totalFlagged, safeLimit),
  };
}

export function isDetectorConcentration(value: unknown): value is DetectorConcentration {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.totalFlagged === "number" &&
    Array.isArray(record.vendorShare) &&
    Array.isArray(record.approverShare)
  );
}
