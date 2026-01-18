// services/api-gateway/src/prototype/prototype-paths.ts

function stripQuery(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

/**
 * Prototype/demo surfaces to hard-disable in production.
 * This is an edge backstop: even if routes were registered, prod returns 404.
 */
export function isPrototypePath(url: string): boolean {
  const path = stripQuery(url);

  // Entire prototype surface
  if (path === "/prototype") return true;
  if (path.startsWith("/prototype/")) return true;

  // Entire demo surface (in case any /demo/* exists at root)
  if (path === "/demo") return true;
  if (path.startsWith("/demo/")) return true;

  // Optional: treat regulator compliance summary as prototype-gated in production
  if (path === "/regulator/compliance/summary") return true;

  return false;
}

/**
 * In non-production, only SOME prototype paths should be admin-only (e.g. monitor).
 * Keep this narrow.
 */
export function isPrototypeAdminOnlyPath(url: string): boolean {
  const path = stripQuery(url);

  if (path === "/prototype/monitor") return true;
  if (path.startsWith("/prototype/monitor/")) return true;

  return false;
}
