export type OrgSetup = {
  jurisdiction?: string; // e.g. "AU"
  enabledObligations?: string[]; // e.g. ["BAS", "PAYGW", "SUPER"]
  defaultPeriod?: string; // e.g. "2024-Q4"
};

const KEY_ORG_ID = "apgms:ux:orgId";
const KEY_SETUP = "apgms:ux:setup";
const KEY_RECENT_PACKS = "apgms:ux:recentEvidencePackIds";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getOrgId(): string {
  const v = localStorage.getItem(KEY_ORG_ID);
  return v && v.trim().length > 0 ? v : "org_demo";
}

export function setOrgId(orgId: string): void {
  localStorage.setItem(KEY_ORG_ID, (orgId || "").trim());
}

export function getSetup(): OrgSetup {
  return safeParse<OrgSetup>(localStorage.getItem(KEY_SETUP), {
    jurisdiction: "AU",
    enabledObligations: ["BAS", "PAYGW", "SUPER"],
    defaultPeriod: "2024-Q4",
  });
}

export function setSetup(setup: OrgSetup): void {
  localStorage.setItem(KEY_SETUP, JSON.stringify(setup ?? {}));
}

export function hasSetup(): boolean {
  return Boolean(localStorage.getItem(KEY_SETUP));
}

export function getRecentEvidencePackIds(): string[] {
  const ids = safeParse<string[]>(localStorage.getItem(KEY_RECENT_PACKS), []);
  return Array.isArray(ids) ? ids : [];
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
