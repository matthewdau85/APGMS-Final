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
      abs.replace(/\.js$/, ".ts"),                 // ./x.js -> ./x.ts
      abs.replace(/\.js$/, ".tsx"),                // ./x.js -> ./x.tsx (just in case)
      abs.replace(/\/index\.js$/, "/index.ts"),    // ./dir/index.js -> ./dir/index.ts
      abs.replace(/\.js$/, "/index.ts"),           // ./dir.js -> ./dir/index.ts (rare but safe)
    ]);

    if (candidate) return candidate;
  }

  return defaultResolver(request, options);
};
