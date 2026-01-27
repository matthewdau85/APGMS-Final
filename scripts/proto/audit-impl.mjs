#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function listFiles(dir, exts, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "build") continue;
      listFiles(p, exts, out);
    } else {
      const ok = exts.some((e) => ent.name.toLowerCase().endsWith(e));
      if (ok) out.push(p);
    }
  }
  return out;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort();
}

function extractFastifyRoutesFromText(txt) {
  // Very pragmatic regex. It catches: app.get("/x"), fastify.post('/x'), etc.
  const re = /\b(?:app|fastify)\.(?:get|post|put|patch|delete|options)\(\s*["'`]([^"'`]+)["'`]/g;
  const out = [];
  let m;
  while ((m = re.exec(txt))) out.push(m[1]);
  return out;
}

function extractReactRouterPaths(txt) {
  // Catches common patterns:
  // <Route path="/x" ...>
  // { path: "/x", element: ... }
  const out = [];
  const re1 = /\bpath\s*=\s*["'`]([^"'`]+)["'`]/g;
  const re2 = /\bpath\s*:\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re1.exec(txt))) out.push(m[1]);
  while ((m = re2.exec(txt))) out.push(m[1]);
  return out;
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
  } catch (e) {
    return "";
  }
}

function main() {
  const repoRoot = process.cwd();

  const apiDir = path.join(repoRoot, "services", "api-gateway", "src");
  const webDir = path.join(repoRoot, "webapp", "src");

  const apiFiles = fs.existsSync(apiDir) ? listFiles(apiDir, [".ts", ".tsx", ".js", ".mjs"]) : [];
  const webFiles = fs.existsSync(webDir) ? listFiles(webDir, [".ts", ".tsx", ".js", ".jsx"]) : [];

  const apiRoutes = [];
  for (const f of apiFiles) {
    const txt = readText(f);
    for (const r of extractFastifyRoutesFromText(txt)) apiRoutes.push(r);
  }

  const uiPaths = [];
  for (const f of webFiles) {
    const txt = readText(f);
    for (const p of extractReactRouterPaths(txt)) uiPaths.push(p);
  }

  const gitSha = safeExec("git rev-parse --short HEAD");
  const now = new Date().toISOString();

  const result = {
    generatedAt: now,
    gitSha: gitSha || null,
    counts: {
      apiFiles: apiFiles.length,
      webFiles: webFiles.length,
      apiRoutes: uniqSorted(apiRoutes).length,
      uiPaths: uniqSorted(uiPaths).length
    },
    apiRoutes: uniqSorted(apiRoutes),
    uiPaths: uniqSorted(uiPaths)
  };

  const outDir = path.join(repoRoot, "artifacts", "proto-audit");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "impl-audit.json");
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");

  const mdPath = path.join(outDir, "impl-audit.md");
  const md =
`# Prototype Implementation Audit

- Generated: ${result.generatedAt}
- Git SHA: ${result.gitSha ?? "unknown"}

## Counts
- API files scanned: ${result.counts.apiFiles}
- Web files scanned: ${result.counts.webFiles}
- Unique API routes found: ${result.counts.apiRoutes}
- Unique UI paths found: ${result.counts.uiPaths}

## API routes
${result.apiRoutes.map((r) => `- \`${r}\``).join("\n")}

## UI paths
${result.uiPaths.map((p) => `- \`${p}\``).join("\n")}
`;
  fs.writeFileSync(mdPath, md, "utf8");

  console.log(`[OK] wrote ${jsonPath}`);
  console.log(`[OK] wrote ${mdPath}`);
}

main();
