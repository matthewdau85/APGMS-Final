const fs = require("fs");
const path = require("path");

function getDefaultResolver(options) {
  if (typeof options.defaultResolver === "function") return options.defaultResolver;

  // eslint-disable-next-line global-require
  const jr = require("jest-resolve");
  if (typeof jr.defaultResolver === "function") return jr.defaultResolver;

  throw new Error("Could not access Jest defaultResolver.");
}

function isRepoCodeBasedir(basedir) {
  if (!basedir) return false;
  if (basedir.includes(`${path.sep}node_modules${path.sep}`)) return false;

  return (
    basedir.includes(`${path.sep}services${path.sep}api-gateway${path.sep}`) ||
    basedir.includes(`${path.sep}shared${path.sep}src${path.sep}`) ||
    basedir.includes(`${path.sep}shared${path.sep}au${path.sep}`) ||
    basedir.includes(`${path.sep}packages${path.sep}`)
  );
}

function tryResolve(defaultResolver, request, options) {
  try {
    return defaultResolver(request, options);
  } catch {
    return null;
  }
}

module.exports = function apgmsJestResolver(request, options) {
  const defaultResolver = getDefaultResolver(options);

  // Only rewrite for your repo code (never node_modules)
  if (!isRepoCodeBasedir(options.basedir)) {
    return defaultResolver(request, options);
  }

  // Only rewrite explicit ".js" specifiers
  if (typeof request !== "string" || !request.endsWith(".js")) {
    return defaultResolver(request, options);
  }

  // 1) Prefer same-path ".ts"
  const asTs = request.replace(/\.js$/, ".ts");
  const r1 = tryResolve(defaultResolver, asTs, options);
  if (r1) return r1;

  // 2) If it was "/index.js", try "/index.ts"
  if (request.endsWith("/index.js")) {
    const asIndexTs = request.replace(/\/index\.js$/, "/index.ts");
    const r2 = tryResolve(defaultResolver, asIndexTs, options);
    if (r2) return r2;
  }

  // 3) Fall back
  return defaultResolver(request, options);
};
