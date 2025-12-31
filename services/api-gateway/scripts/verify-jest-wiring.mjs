import fs from "fs";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function exists(rel) {
  const p = path.join(rootDir, rel);
  return fs.existsSync(p);
}

// 1) required files
const required = ["jest.config.mjs", "test/jest.setup.ts", "test/jest-resolver.cjs"];
for (const f of required) {
  if (!exists(f)) fail(`Missing required file: ${f}`);
}
if (process.exitCode) process.exit(1);
ok(`Required files exist (${required.join(", ")})`);

// 2) config imports
let cfg;
try {
  cfg = (await import(path.join(rootDir, "jest.config.mjs"))).default;
  ok("jest.config.mjs imports successfully");
} catch (e) {
  console.error(e);
  fail("jest.config.mjs failed to import");
  process.exit(1);
}

// 3) basic wiring checks
if (!Array.isArray(cfg.testMatch) || !cfg.testMatch.some((s) => String(s).includes("/test/"))) {
  fail("Config testMatch does not appear to target <rootDir>/test/**/*.test.ts");
}
if (!Array.isArray(cfg.setupFiles) || !cfg.setupFiles.includes("<rootDir>/test/jest.setup.ts")) {
  fail('Config setupFiles must include "<rootDir>/test/jest.setup.ts"');
}
if (cfg.resolver !== "<rootDir>/test/jest-resolver.cjs") {
  fail('Config resolver must be "<rootDir>/test/jest-resolver.cjs"');
}
if (!process.exitCode) ok("Config wiring (testMatch/setupFiles/resolver) looks correct");

// 4) detect jest.<ident>( calls in config (but ignore strings/comments)
const configPath = path.join(rootDir, "jest.config.mjs");
const configText = fs.readFileSync(configPath, "utf8");

// strip strings (", ', `) crudely but effectively for this purpose
const noStrings = configText.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, "");
// strip single-line comments
const noStringsNoLineComments = noStrings.replace(/\/\/.*$/gm, "");
// strip block comments
const scrubbed = noStringsNoLineComments.replace(/\/\*[\s\S]*?\*\//g, "");

const hasJestCalls = /\bjest\.[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(scrubbed);
if (hasJestCalls) {
  fail("jest.config.mjs contains jest.* calls (move them to test/jest.setup.ts)");
} else {
  ok("jest.config.mjs has no jest.*() calls");
}

if (process.exitCode) process.exit(1);
