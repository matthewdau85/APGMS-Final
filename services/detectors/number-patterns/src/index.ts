export type MonitoringSnapshotRecord = {
  id: string;
  orgId: string;
  type: string;
  createdAt: Date;
  payload: unknown;
  computeVersion?: string | null;
  populationNote?: string | null;
  consecutivePeriods?: number | null;
  isMuted?: boolean | null;
  mutedReason?: string | null;
  spikes?: unknown | null;
};

export interface BenfordDigitBin {
  digit: string;
  observed: number;
  expected: number;
  deviation: number;
}

export interface BenfordSuggestedFilter {
  field: string;
  values: string[];
  rationale?: string;
  sampleCount?: number | null;
}

export interface BenfordSpike {
  label: string;
  periodStart: string;
  periodEnd: string;
  magnitude: number;
  confidence?: number | null;
  metric?: string | null;
}

export interface BenfordMutingMetadata {
  isMuted: boolean;
  mutedReason: string | null;
  mutedAt?: string | null;
  mutedBy?: string | null;
}

export interface BenfordMetadata {
  computeVersion: string;
  generatedAt: string;
  populationSize?: number | null;
  populationNote?: string | null;
  consecutivePeriods?: number | null;
  muting: BenfordMutingMetadata;
  sampleWindow?: { start: string; end: string } | null;
  sampleReference?: string | null;
  sampleCount?: number | null;
}

export interface BenfordAdvisoryCopy {
  headline: string;
  summary: string;
  mutedSummary?: string | null;
  callToAction?: {
    label: string;
    href?: string;
    filter?: Record<string, unknown>;
  } | null;
}

export interface BenfordDetectorSnapshot {
  id: string;
  type: string;
  bins: BenfordDigitBin[];
  metadata: BenfordMetadata;
  suggestedFilters: BenfordSuggestedFilter[];
  spikes: BenfordSpike[];
  advisoryCopy: BenfordAdvisoryCopy;
}

export interface BenfordRawSample {
  id: string;
  occurredAt: string;
  amount: number;
  description?: string | null;
  accountCode?: string | null;
  counterparty?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RawSampleRequestOptions {
  ledgerBaseUrl?: string;
  fetchImpl?: FetchLike;
  authToken?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignalLike;
}

type DetectorStoragePayload = {
  generatedAt?: unknown;
  bins?: unknown;
  sampleWindow?: unknown;
  sampleReference?: unknown;
  sampleCount?: unknown;
  suggestedFilters?: unknown;
  populationNote?: unknown;
  consecutivePeriods?: unknown;
  computeVersion?: unknown;
  spikes?: unknown;
};

type SuggestedFilterRecord = {
  field?: unknown;
  values?: unknown;
  rationale?: unknown;
  sampleCount?: unknown;
};

type SpikeRecord = {
  label?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  magnitude?: unknown;
  confidence?: unknown;
  metric?: unknown;
};

type FetchLikeResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type FetchLike = (input: string | URL, init?: FetchLikeInit) => Promise<FetchLikeResponse>;

type FetchLikeInit = {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignalLike;
};

export type AbortSignalLike = {
  readonly aborted: boolean;
};

const DETECTOR_TYPE_PREFIX = "number-patterns";

export function mapMonitoringSnapshotToBenford(
  snapshot: MonitoringSnapshotRecord,
): BenfordDetectorSnapshot | null {
  if (!snapshot.type.startsWith(DETECTOR_TYPE_PREFIX)) {
    return null;
  }

  const payload = (snapshot.payload ?? {}) as DetectorStoragePayload;

  const bins = normaliseBins(payload.bins);
  const suggestedFilters = normaliseSuggestedFilters(payload.suggestedFilters);
  const spikes = normaliseSpikes(snapshot.spikes ?? payload.spikes);

  const metadata: BenfordMetadata = {
    computeVersion:
      parseString(snapshot.computeVersion) ??
      parseString(payload.computeVersion) ??
      "unknown",
    generatedAt:
      parseString(payload.generatedAt) ??
      snapshot.createdAt.toISOString(),
    populationNote:
      parseString(snapshot.populationNote) ??
      parseString(payload.populationNote),
    consecutivePeriods:
      typeof snapshot.consecutivePeriods === "number"
        ? snapshot.consecutivePeriods
        : typeof payload.consecutivePeriods === "number"
          ? payload.consecutivePeriods
          : null,
    muting: {
      isMuted: Boolean(snapshot.isMuted),
      mutedReason: parseString(snapshot.mutedReason),
    },
    sampleWindow: parseWindow(payload.sampleWindow),
    sampleReference: parseString(payload.sampleReference),
    sampleCount: typeof payload.sampleCount === "number" ? payload.sampleCount : null,
  };

  const advisoryCopy = buildAdvisoryCopy(bins, metadata, suggestedFilters, spikes);

  return {
    id: snapshot.id,
    type: snapshot.type,
    bins,
    metadata,
    suggestedFilters,
    spikes,
    advisoryCopy,
  };
}

export async function fetchBenfordRawSamples(
  sampleReference: string | null | undefined,
  options: RawSampleRequestOptions = {},
): Promise<BenfordRawSample[]> {
  const reference = parseString(sampleReference);
  if (!reference) {
    return [];
  }

  const fetcher = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!fetcher) {
    throw new Error("fetch_not_available");
  }

  const baseUrl = options.ledgerBaseUrl ?? process.env.LEDGER_API_URL ?? "http://ledger:3000";
  const baseUrlWithTrailingSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(
    `detectors/benford/raw/${encodeURIComponent(reference)}`,
    baseUrlWithTrailingSlash,
  );
  if (options.limit !== undefined && Number.isFinite(options.limit)) {
    url.searchParams.set("limit", String(options.limit));
  }
  if (options.offset !== undefined && Number.isFinite(options.offset)) {
    url.searchParams.set("offset", String(options.offset));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.authToken) {
    headers.Authorization = options.authToken.startsWith("Bearer ")
      ? options.authToken
      : `Bearer ${options.authToken}`;
  }

  const response = await fetcher(url, {
    method: "GET",
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`ledger_fetch_failed:${response.status}`);
  }

  const body = (await response.json()) as { samples?: unknown };
  return normaliseSamples(body.samples);
}

function normaliseBins(value: unknown): BenfordDigitBin[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const digit = parseString(record.digit ?? record.label ?? record.bucket);
      const observed = toNumber(record.observed ?? record.count ?? record.value);
      const expected = toNumber(record.expected ?? record.expectedCount ?? record.expectedValue);
      const deviation = toNumber(record.deviation ?? record.delta ?? 0);
      if (!digit || observed === null || expected === null || deviation === null) {
        return null;
      }
      return {
        digit,
        observed,
        expected,
        deviation,
      } satisfies BenfordDigitBin;
    })
    .filter((item): item is BenfordDigitBin => item !== null);
}

function normaliseSuggestedFilters(value: unknown): BenfordSuggestedFilter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = entry as SuggestedFilterRecord;
      const field = parseString(record.field);
      const values = Array.isArray(record.values)
        ? record.values.map((item) => parseString(item)).filter((item): item is string => Boolean(item))
        : [];
      if (!field || values.length === 0) {
        return null;
      }
      return {
        field,
        values,
        rationale: parseString(record.rationale),
        sampleCount:
          typeof record.sampleCount === "number"
            ? record.sampleCount
            : null,
      } satisfies BenfordSuggestedFilter;
    })
    .filter((item): item is BenfordSuggestedFilter => item !== null);
}

function normaliseSpikes(value: unknown): BenfordSpike[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = entry as SpikeRecord;
      const label = parseString(record.label ?? record.bucket ?? record.name);
      const periodStart = parseString(record.periodStart ?? record.start);
      const periodEnd = parseString(record.periodEnd ?? record.end);
      const magnitude = toNumber(record.magnitude ?? record.value ?? record.delta);
      if (!label || !periodStart || !periodEnd || magnitude === null) {
        return null;
      }
      return {
        label,
        periodStart,
        periodEnd,
        magnitude,
        confidence: typeof record.confidence === "number" ? record.confidence : null,
        metric: parseString(record.metric),
      } satisfies BenfordSpike;
    })
    .filter((item): item is BenfordSpike => item !== null);
}

function normaliseSamples(value: unknown): BenfordRawSample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = parseString(record.id ?? record.ledgerId ?? record.reference);
      const occurredAt = parseString(record.occurredAt ?? record.timestamp ?? record.date);
      const amount = toNumber(record.amount ?? record.amountCents ?? record.value);
      if (!id || !occurredAt || amount === null) {
        return null;
      }
      const metadata = normaliseRecord(record.metadata ?? record.details ?? record.context);
      return {
        id,
        occurredAt,
        amount,
        description: parseString(record.description ?? record.memo ?? record.notes),
        accountCode: parseString(record.accountCode ?? record.account),
        counterparty: parseString(record.counterparty ?? record.payee ?? record.vendor),
        metadata: metadata ?? undefined,
      } satisfies BenfordRawSample;
    })
    .filter((item): item is BenfordRawSample => item !== null);
}

function parseWindow(value: unknown): { start: string; end: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const start = parseString(record.start ?? record.from ?? record.begin);
  const end = parseString(record.end ?? record.to ?? record.finish);
  if (!start || !end) {
    return null;
  }
  return { start, end };
}

function parseString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normaliseRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildAdvisoryCopy(
  bins: BenfordDigitBin[],
  metadata: BenfordMetadata,
  filters: BenfordSuggestedFilter[],
  spikes: BenfordSpike[],
): BenfordAdvisoryCopy {
  if (metadata.muting.isMuted) {
    return {
      headline: "Detector muted",
      summary: "Alerts and escalations are paused for this detector.",
      mutedSummary: metadata.muting.mutedReason ?? "Muted by a regulator or administrator.",
      callToAction: null,
    };
  }

  if (spikes.length > 0) {
    const firstSpike = spikes[0];
    return {
      headline: "Potential anomalies detected",
      summary: `Detected ${spikes.length} spike${spikes.length > 1 ? "s" : ""} between ${firstSpike.periodStart} and ${firstSpike.periodEnd}.`,
      mutedSummary: null,
      callToAction: buildFilterCta(filters),
    };
  }

  const maxDeviation = bins.reduce<number>((current, bin) => {
    const deviation = Math.abs(bin.deviation);
    return deviation > current ? deviation : current;
  }, 0);

  if (maxDeviation >= 0.05) {
    return {
      headline: "Minor deviation observed",
      summary: "Slight anomalies detected; monitor but no immediate action required.",
      mutedSummary: null,
      callToAction: buildFilterCta(filters),
    };
  }

  return {
    headline: "Distribution within expectations",
    summary: "Latest computation aligns with Benford expectations for the selected population.",
    mutedSummary: null,
    callToAction: null,
  };
}

function buildFilterCta(filters: BenfordSuggestedFilter[]): BenfordAdvisoryCopy["callToAction"] {
  const primary = filters[0];
  if (!primary) {
    return null;
  }
  return {
    label: `Apply ${primary.field} filter`,
    filter: {
      field: primary.field,
      values: primary.values,
      rationale: primary.rationale ?? undefined,
    },
  };
}
