export type OrgSetup = {
  jurisdiction?: string; // e.g. "AU"
  enabledObligations?: string[]; // e.g. ["BAS", "PAYGW", "SUPER"]
  defaultPeriod?: string; // e.g. "2024-Q4"
};

const KEY_ORG_ID = "apgms:ux:orgId";
const KEY_SETUP = "apgms:ux:setup";
const KEY_RECENT_PACKS = "apgms:ux:recentEvidencePackIds";

// Legacy keys used by older pages/tests/exports.
const LEGACY_KEY_ORG_ID = "apgms.org.id";
const LEGACY_KEY_SETUP = "apgms.org.setup";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function normalizeStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return arr.length > 0 ? arr : undefined;
}

function mapLegacySetup(legacy: unknown): OrgSetup | null {
  if (!isRecord(legacy)) return null;

  const jurisdiction = normalizeString(legacy["jurisdiction"]);
  const defaultPeriod = normalizeString(legacy["defaultPeriod"]);
  const enabledObligations = normalizeStringArray(legacy["enabledObligations"]);

  // Some legacy exports used different shapes; try best-effort mapping.
  // If someone stored "taxTypes" or similar, we do NOT auto-map it to obligations.
  // Only accept explicit "enabledObligations" and "defaultPeriod".
  const setup: OrgSetup = {};
  if (jurisdiction) setup.jurisdiction = jurisdiction;
  if (defaultPeriod) setup.defaultPeriod = defaultPeriod;
  if (enabledObligations) setup.enabledObligations = enabledObligations;

  // If we found nothing usable, treat as invalid.
  if (!setup.jurisdiction && !setup.defaultPeriod && !setup.enabledObligations) return null;

  return setup;
}

export function getOrgId(): string {
  // Current key
  const v = localStorage.getItem(KEY_ORG_ID);
  if (v && v.trim().length > 0) return v.trim();

  // Legacy key
  const legacy = localStorage.getItem(LEGACY_KEY_ORG_ID);
  if (legacy && legacy.trim().length > 0) {
    const id = legacy.trim();
    try {
      localStorage.setItem(KEY_ORG_ID, id);
    } catch {
      // ignore
    }
    return id;
  }

  // Default used across the app/tests
  return "org_demo";
}

export function setOrgId(orgId: string): void {
  const id = (orgId || "").trim();
  localStorage.setItem(KEY_ORG_ID, id);

  // Keep legacy in sync (harmless; helps older paths/tests).
  try {
    localStorage.setItem(LEGACY_KEY_ORG_ID, id);
  } catch {
    // ignore
  }
}

export function getSetup(): OrgSetup {
  const defaults: OrgSetup = {
    jurisdiction: "AU",
    enabledObligations: ["BAS", "PAYGW", "SUPER"],
    defaultPeriod: "2024-Q4",
  };

  // Prefer current key
  const current = safeParse<unknown>(localStorage.getItem(KEY_SETUP), null);
  const mappedCurrent = mapLegacySetup(current) || (isRecord(current) ? (current as OrgSetup) : null);

  if (mappedCurrent) {
    // Ensure defaults for missing fields
    return {
      jurisdiction: mappedCurrent.jurisdiction ?? defaults.jurisdiction,
      enabledObligations: mappedCurrent.enabledObligations ?? defaults.enabledObligations,
      defaultPeriod: mappedCurrent.defaultPeriod ?? defaults.defaultPeriod,
    };
  }

  // Fallback to legacy key
  const legacyRaw = localStorage.getItem(LEGACY_KEY_SETUP);
  const legacyParsed = safeParse<unknown>(legacyRaw, null);
  const legacyMapped = mapLegacySetup(legacyParsed);

  if (legacyMapped) {
    const merged: OrgSetup = {
      jurisdiction: legacyMapped.jurisdiction ?? defaults.jurisdiction,
      enabledObligations: legacyMapped.enabledObligations ?? defaults.enabledObligations,
      defaultPeriod: legacyMapped.defaultPeriod ?? defaults.defaultPeriod,
    };

    // Migrate forward to the current key so the rest of the app sees one source.
    try {
      localStorage.setItem(KEY_SETUP, JSON.stringify(merged));
    } catch {
      // ignore
    }

    return merged;
  }

  return defaults;
}

export function setSetup(setup: OrgSetup): void {
  localStorage.setItem(KEY_SETUP, JSON.stringify(setup ?? {}));

  // Keep legacy in sync to avoid split-brain during transitions.
  try {
    localStorage.setItem(LEGACY_KEY_SETUP, JSON.stringify(setup ?? {}));
  } catch {
    // ignore
  }
}

export function hasSetup(): boolean {
  if (localStorage.getItem(KEY_SETUP)) return true;
  if (localStorage.getItem(LEGACY_KEY_SETUP)) return true;
  return false;
}

export function getRecentEvidencePackIds(): string[] {
  const ids = safeParse<unknown>(localStorage.getItem(KEY_RECENT_PACKS), []);
  if (!Array.isArray(ids)) return [];
  return ids.filter((x) => typeof x === "string") as string[];
}

export function addRecentEvidencePackId(packId: string): void {
  const id = (packId || "").trim();
  if (!id) return;

  const existing = getRecentEvidencePackIds();
  const next = [id, ...existing.filter((x) => x !== id)].slice(0, 25);
  localStorage.setItem(KEY_RECENT_PACKS, JSON.stringify(next));
}

export function clearRecentEvidencePackIds(): void {
  localStorage.removeItem(KEY_RECENT_PACKS);
}
