// services/api-gateway/src/prototype/prototype-paths.ts

function stripQuery(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

/**
 * Prototype / demo surfaces to hard-disable in production.
 * This is an edge backstop: even if routes were registered, prod returns 404.
 */
export function isPrototypePath(url: string): boolean {
  const path = stripQuery(url);

  // Entire prototype surface
  if (path === "/prototype") return true;
  if (path.startsWith("/prototype/")) return true;

  // Entire demo surface (registered only when ENABLE_PROTOTYPE=true, but still block in prod)
  if (path === "/demo") return true;
  if (path.startsWith("/demo/")) return true;

  // Treat regulator compliance summary as prototype-gated in production if desired
  if (path === "/regulator/compliance/summary") return true;

  return false;
}

/**
 * In non-production, only SOME prototype paths are admin-only (example: monitor).
 * Keep this narrow: most prototype UX can be open to non-admin if you want.
 */
export function isPrototypeAdminOnlyPath(url: string): boolean {
  const path = stripQuery(url);

  // Admin-only prototype monitor
  if (path === "/prototype/monitor") return true;

  return false;
}
