function splitUrl(url: string): { path: string; query: string } {
  const q = url.indexOf("?");
  if (q === -1) return { path: url, query: "" };
  return { path: url.slice(0, q), query: url.slice(q + 1) };
}

function hasQueryParam(query: string, key: string): boolean {
  if (!query) return false;
  // Basic query scan; avoids URLSearchParams to keep it deterministic for raw inject URLs
  return query
    .split("&")
    .some((kv) => kv === key || kv.startsWith(`${key}=`));
}

/**
 * Prototype endpoints:
 * - Disabled in production (404)
 * - In non-prod, only some are admin-only (403 for non-admin)
 *
 * This logic is intentionally aligned to the contract tests.
 */
export function isPrototypePath(url: string): boolean {
  const { path } = splitUrl(url);

  if (path === "/prototype/monitor") return true;
  if (path.startsWith("/monitor/")) return true;

  // Treat regulator compliance summary as prototype-gated in production.
  if (path === "/regulator/compliance/summary") return true;

  return false;
}

export function isPrototypeAdminOnlyPath(url: string): boolean {
  const { path, query } = splitUrl(url);

  // Admin-only prototype monitor
  if (path === "/prototype/monitor") return true;

  // All /monitor/* endpoints are admin-only in non-prod
  if (path.startsWith("/monitor/")) return true;

  return false;
}
