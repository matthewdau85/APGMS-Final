// services/api-gateway/src/prototype/prototype-paths.ts

/**
 * Minimal path classification used by app.ts to hard-disable prototype/demo surfaces in production.
 * Keep this conservative and explicit.
 */

export function isPrototypePath(urlOrPath: string): boolean {
  const path = (urlOrPath || "").split("?")[0] || "";
  if (path.startsWith("/prototype")) return true;
  if (path === "/demo" || path.startsWith("/demo/")) return true;

  // Treat regulator compliance summary as prototype-gated in production.
  if (path.startsWith("/regulator/")) return true;

  return false;
}

export function isPrototypeAdminOnlyPath(urlOrPath: string): boolean {
  const path = (urlOrPath || "").split("?")[0] || "";

  // In this Option A wiring, all prototype + demo endpoints are admin-only.
  if (path.startsWith("/prototype")) return true;
  if (path === "/demo" || path.startsWith("/demo/")) return true;

  return false;
}
