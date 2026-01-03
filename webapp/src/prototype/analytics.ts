export type AnalyticsEvent = {
  id: string;
  ts: number;
  name: string;
  props?: Record<string, unknown>;
};

const STORAGE_KEY = "apgms_demo_analytics_v1";

function now() {
  return Date.now();
}

function safeParse(raw: string): AnalyticsEvent[] {
  try {
    const arr = JSON.parse(raw) as AnalyticsEvent[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x.id === "string" && typeof x.ts === "number" && typeof x.name === "string");
  } catch {
    return [];
  }
}

function readAll(): AnalyticsEvent[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return safeParse(raw);
}

function writeAll(events: AnalyticsEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)));
}

function makeId(prefix: string) {
  return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Math.random().toString(16).slice(2);
}

export function track(name: string, props?: Record<string, unknown>) {
  const e: AnalyticsEvent = { id: makeId("evt"), ts: now(), name, props };
  const all = readAll();
  all.push(e);
  writeAll(all);

  // Demo default: console trace only.
  // Production wiring: forward to PostHog/GA/Segment here.
  // Keep this function as the single funnel point.
  // eslint-disable-next-line no-console
  console.log("[apgms.analytics]", name, props ?? {});
}

export function getAnalyticsEvents(): AnalyticsEvent[] {
  return readAll().slice().sort((a, b) => b.ts - a.ts);
}

export function resetAnalytics() {
  localStorage.removeItem(STORAGE_KEY);
}
