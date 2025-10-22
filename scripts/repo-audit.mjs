// scripts/repo-audit.mjs
// Node 18+/20+ ESM script. Scans repo and prints a Markdown report.
// It also writes the report to ./repo-audit-report.md.
// Optional: attempts pnpm install/build/test; continues on error and logs results.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";

const cwd = process.cwd();
const reportLines = [];
const push = (s = "") => reportLines.push(s);

const tryExec = (cmd, opts = {}) => {
  try {
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    return { ok: true, out: out.toString().trim() };
  } catch (err) {
    return { ok: false, err, out: (err?.stdout || "").toString().trim(), msg: (err?.stderr || "").toString().trim() };
  }
};

const section = (title) => { push(`\n## ${title}\n`); };

// Utility helpers
const hasFile = (p) => existsSync(join(cwd, p));
const readText = (p) => readFileSync(join(cwd, p), "utf8");
const jsonOrNull = (p) => { try { return JSON.parse(readText(p)); } catch { return null; } };

const checkTrackedNodeModules = () => {
  const res = tryExec(`git ls-files -z node_modules/**`);
  if (!res.ok) return { tracked: false, count: 0 }; // not tracked or git not init
  const count = res.out ? res.out.split("\0").filter(Boolean).length : 0;
  return { tracked: count > 0, count };
};

const semverSatisfies = (range, wantMajor, wantMinor) => {
  // Very light check: >=20.11 means allow 21, etc. We just parse the lower bound if present.
  if (!range) return false;
  const m = range.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return false;
  const [ , maj, min ] = m.map(Number);
  return maj > wantMajor || (maj === wantMajor && min >= wantMinor);
};

// Start report
push(`# APGMS Repo Audit Report\n`);
push(`Repo: \`${basename(cwd)}\`\n`);
push(`_This report checks the hygiene items you listed (steps 0–11) and shows pass/fail with remediation tips._\n`);

//
// 0) Preconditions (node/pnpm/git)
//
section("0) Preconditions");
const vNode = tryExec(`node -v`);
const vPNPM = tryExec(`pnpm -v`);
const vGit  = tryExec(`git --version`);
push(`- Node: ${vNode.ok ? "`" + vNode.out + "` ✅" : "❌ not found"}`);
push(`- pnpm: ${vPNPM.ok ? "`" + vPNPM.out + "` ✅" : "❌ not found"}`);
push(`- Git:  ${vGit.ok ? "`" + vGit.out + "` ✅" : "❌ not found"}`);
if (!vPNPM.ok) push(`  - If pnpm isn’t installed: \`corepack enable && corepack prepare pnpm@9.6.0 --activate\``);

//
// 1) Git repo & remote
//
section("1) Git repo & remote");
const isGit = tryExec(`git rev-parse --is-inside-work-tree`);
if (isGit.ok && isGit.out === "true") {
  const remotes = tryExec(`git remote -v`);
  push(`- Git repo detected ✅`);
  push(remotes.ok ? "```\n" + remotes.out + "\n```" : "- (couldn’t read remotes)");
} else {
  push(`- ❌ Not a git repo here. Run \`git init\` and add the correct origin.`);
}

//
// 2–3) .gitignore rules for node_modules
//
section("2–3) .gitignore excludes node_modules");
let hasIgnore = hasFile(".gitignore");
let ignoreText = hasIgnore ? readText(".gitignore") : "";
const ignoresNodeModules = hasIgnore && /\bnode_modules\/?\b/.test(ignoreText);
push(`- .gitignore present: ${hasIgnore ? "✅" : "❌"}`);
push(`- node_modules ignored: ${ignoresNodeModules ? "✅" : "❌ Add \`node_modules/\` to .gitignore"}`);

//
// 4) package.json fields
//
section("4) package.json fields");
const pkg = jsonOrNull("package.json");
if (!pkg) {
  push("❌ No package.json at repo root.");
} else {
  const pm = pkg.packageManager || "";
  const enginesNode = pkg.engines?.node || "";
  const isPnpm = /^pnpm@/.test(pm);
  const pinnedPnpmOK = /^pnpm@9\./.test(pm);

  push(`- private: ${pkg.private ? "✅" : "❌ add \"private\": true"}`);
  push(`- packageManager: ${pm ? "`" + pm + "`" : "❌ missing" } ${isPnpm ? (pinnedPnpmOK ? "✅" : "⚠️ prefer pnpm@9.x") : "⚠️ prefer pnpm"}`);
  push(`- engines.node: ${enginesNode ? "`" + enginesNode + "`" : "❌ missing"} ${semverSatisfies(enginesNode, 20, 11) ? "✅" : "⚠️ target >=20.11"}`);

  const scripts = pkg.scripts || {};
  push(`- scripts.install:all = ${scripts["install:all"] ? "`" + scripts["install:all"] + "` ✅" : "❌ add \"install:all\": \"pnpm -r install --frozen-lockfile\""}`);
  push(`- scripts.build       = ${scripts["build"] ? "`" + scripts["build"] + "` ✅" : "❌ add \"build\": \"pnpm -r build\""}`);
  push(`- scripts.test        = ${scripts["test"] ? "`" + scripts["test"] + "` ✅" : "❌ add \"test\": \"pnpm -r test\""}`);

  if (pkg.workspaces) {
    push(`- workspaces: ✅ (${Array.isArray(pkg.workspaces) ? pkg.workspaces.join(", ") : "(object)"})`);
  } else {
    push(`- workspaces: (none) – OK if not a monorepo.`);
  }
}

//
// 5) Lockfiles
//
section("5) Lockfiles (standardize on pnpm)");
const hasPnpmLock = hasFile("pnpm-lock.yaml");
const hasYarnLock = hasFile("yarn.lock");
const hasNpmLock  = hasFile("package-lock.json");
const pnpmLockMsg = hasPnpmLock ? "✅" : "❌ missing (run `pnpm import` or install once)";
push(`- pnpm-lock.yaml: ${pnpmLockMsg}`);
push(`- yarn.lock: ${hasYarnLock ? "⚠️ present (delete if using pnpm)" : "✅ not present"}`);
push(`- package-lock.json: ${hasNpmLock ? "⚠️ present (delete if using pnpm)" : "✅ not present"}`);

//
// 6) Tracked node_modules
//
section("6) node_modules tracked in git?");
const tracked = checkTrackedNodeModules();
const trackedMsg = tracked.tracked
  ? `❌ ${tracked.count} files tracked (run \`git rm -r --cached node_modules\`)`
  : "✅ none tracked";
push(`- Tracked node_modules files: ${trackedMsg}`);

//
// 7) Install/build/test (optional run)
//
section("7) Install / build / test (attempt)");
let installOK = false, buildOK = false, testOK = false;
if (vPNPM.ok && hasPnpmLock) {
  const inst = tryExec(`pnpm -r install --frozen-lockfile`, { cwd });
  installOK = inst.ok;
  let installLine = `- pnpm install (frozen): ${installOK ? "✅" : "❌"}`;
  if (!inst.ok && (inst.msg || inst.out)) {
    installLine += `\n  \`\`\`\n${inst.msg || inst.out}\n  \`\`\``;
  }
  push(installLine);

  const bld = tryExec(`pnpm -r build`, { cwd });
  buildOK = bld.ok;
  let buildLine = `- pnpm build: ${buildOK ? "✅" : "❌"}`;
  if (!bld.ok && (bld.msg || bld.out)) {
    buildLine += `\n  \`\`\`\n${bld.msg || bld.out}\n  \`\`\``;
  }
  push(buildLine);

  const tst = tryExec(`pnpm -r test -- --reporter=dot`, { cwd });
  testOK = tst.ok;
  let testLine = `- pnpm test: ${testOK ? "✅" : "❌"}`;
  if (!tst.ok && (tst.msg || tst.out)) {
    testLine += `\n  \`\`\`\n${tst.msg || tst.out}\n  \`\`\``;
  }
  push(testLine);
} else {
  push(`- Skipped (pnpm not available or pnpm-lock.yaml missing).`);
}

//
// 8–9) CI workflow presence & content
//
section("8–9) GitHub Actions CI");
const ciPath = ".github/workflows/ci.yml";
const hasCI = hasFile(ciPath);
push(`- ci.yml present: ${hasCI ? "✅" : "❌ missing"}`);
if (hasCI) {
  const ci = readText(ciPath);
  const usesNode20 = /node-version:\s*['"]?20\./.test(ci);
  const cachesPNPM = /cache:\s*['"]?pnpm['"]?/.test(ci);
  const setupPNPM  = /pnpm\/action-setup@/.test(ci);
  const frozen     = /pnpm -r install --frozen-lockfile/.test(ci);
  const hasBuild   = /pnpm -r build/.test(ci);
  const hasTest    = /pnpm -r test/.test(ci);

  push(`  - Node >=20 in CI: ${usesNode20 ? "✅" : "❌"}`);
  push(`  - pnpm cache:      ${cachesPNPM ? "✅" : "❌"}`);
  push(`  - pnpm setup:      ${setupPNPM ? "✅" : "❌"}`);
  push(`  - frozen install:  ${frozen ? "✅" : "❌"}`);
  push(`  - build step:      ${hasBuild ? "✅" : "❌"}`);
  push(`  - test step:       ${hasTest ? "✅" : "❌"}`);
} else {
  push(`  - Add the standard CI workflow to auto-install/build/test.`);
}

//
// 10) Fresh-clone instructions (always pass; just print)
//
section("10) Fresh clone instructions");
push([
  "```powershell",
  "git clone https://github.com/<your-username>/<your-repo>.git",
  "cd <your-repo>",
  "pnpm -r install --frozen-lockfile",
  "pnpm -r build",
  "pnpm -r test",
  "```"
].join("\n"));

//
// 11) Optional Dockerfile check
//
section("11) Optional Dockerfile (example path)");
const dockerPath = "services/api/Dockerfile";
if (hasFile(dockerPath)) {
  const text = readText(dockerPath);
  const hasPnpmLockCopy = /pnpm-lock\.yaml/.test(text);
  const usesFrozen = /pnpm install --frozen-lockfile/.test(text);
  push(`- ${dockerPath} exists: ✅`);
  push(`  - copies pnpm-lock.yaml: ${hasPnpmLockCopy ? "✅" : "❌"}`);
  push(`  - uses frozen install:    ${usesFrozen ? "✅" : "❌"}`);
} else {
  push(`- No ${dockerPath} found. If you ship containers, add one that installs from lockfile.`);
}

// Overall summary
section("Summary");
const okCount = reportLines.filter(l => l.includes("✅")).length;
const warnErr = reportLines.filter(l => l.includes("❌") || l.includes("⚠️")).length;
push(`- Checks passing: **${okCount}**`);
push(`- Warnings/Errors: **${warnErr}**`);

const md = reportLines.join("\n");
console.log(md);
writeFileSync(join(cwd, "repo-audit-report.md"), md, "utf8");
