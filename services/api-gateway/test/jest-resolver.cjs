const path = require("path");
const fs = require("fs");

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = (request, options) => {
  const basedir = options.basedir || process.cwd();
  const defaultResolver = options.defaultResolver;

  if (typeof defaultResolver !== "function") {
    throw new Error("Jest did not provide options.defaultResolver");
  }

  // Rewrite ONLY relative .js specifiers to their .ts source when present.
  if (request.startsWith(".") && request.endsWith(".js")) {
    const abs = path.resolve(basedir, request);

    const candidate = firstExisting([
      abs.replace(/\.js$/, ".ts"),
      abs.replace(/\.js$/, ".tsx"),
      abs.replace(/\/index\.js$/, "/index.ts"),
      abs.replace(/\.js$/, "/index.ts"),
    ]);

    if (candidate) return candidate;
  }

  return defaultResolver(request, options);
};
