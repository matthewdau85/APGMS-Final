"use strict";

const fs = require("node:fs");
const path = require("node:path");

function pass(detail) { return { status: "PASS", detail: detail || "" }; }
function fail(detail) { return { status: "FAIL", detail: detail || "" }; }
function skip(detail) { return { status: "SKIP", detail: detail || "" }; }

function existsFile(root, p) {
  try { return fs.statSync(path.join(root, p)).isFile(); } catch { return false; }
}
function existsDir(root, p) {
  try { return fs.statSync(path.join(root, p)).isDirectory(); } catch { return false; }
}

function readText(root, p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}

function packageJson(root) {
  return JSON.parse(readText(root, "package.json"));
}

function packageJsonHasAllScripts(root, scripts) {
  const pj = packageJson(root);
  const s = pj.scripts || {};
  return scripts.every(k => typeof s[k] === "string" && s[k].trim().length > 0);
}
function packageJsonHasAnyScript(root, scripts) {
  const pj = packageJson(root);
  const s = pj.scripts || {};
  return scripts.some(k => typeof s[k] === "string" && s[k].trim().length > 0);
}

function fileRegex(root, p, pattern) {
  if (!existsFile(root, p)) return false;
  const re = new RegExp(pattern, "m");
  return re.test(readText(root, p));
}

function jsonHasPath(root, p, jsonPointer) {
  if (!existsFile(root, p)) return false;
  const obj = JSON.parse(readText(root, p));
  // minimal JSON pointer: /a/b/0/c
  const parts = jsonPointer.split("/").filter(Boolean).map(decodeURIComponent);
  let cur = obj;
  for (const part of parts) {
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isFinite(idx) || idx < 0 || idx >= cur.length) return false;
      cur = cur[idx];
    } else if (cur && typeof cur === "object") {
      if (!(part in cur)) return false;
      cur = cur[part];
    } else {
      return false;
    }
  }
  return true;
}

function dockerComposeHasServices(root, composePath, services) {
  if (!existsFile(root, composePath)) return false;
  const t = readText(root, composePath);
  // very lightweight: look for "\n  <serviceName>:" under "services:"
  // This is not a full YAML parser but works for standard compose files.
  return services.every(svc => {
    const re = new RegExp("\\n\\s{0,6}" + svc.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s*:", "m");
    return re.test(t);
  });
}

function evidenceLatestPath(root, evidenceDirRel) {
  const evidenceDir = path.join(root, evidenceDirRel);
  if (!fs.existsSync(evidenceDir)) return null;
  const files = fs.readdirSync(evidenceDir)
    .filter(f => f.toLowerCase().endsWith(".md"))
    .map(f => ({ f, t: fs.statSync(path.join(evidenceDir, f)).mtimeMs }))
    .sort((a,b) => b.t - a.t);
  return files.length ? path.join(evidenceDir, files[0].f) : null;
}

function evidenceNoSecretPatterns(text) {
  const patterns = [
    /AKIA[0-9A-Z]{16}/g,                     // AWS access key id (heuristic)
    /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/g,
    /(password|passwd|pwd)\s*[:=]\s*[^\\s]{6,}/ig,
    /(secret|api[_-]?key|token)\s*[:=]\s*[^\\s]{12,}/ig
  ];
  return !patterns.some(re => re.test(text));
}

function osfEvidenceLinksResolve(root, evidenceLinks) {
  // evidenceLinks: array of { href, text }
  // resolve local links only (no http)
  const local = evidenceLinks.filter(l => l.href && !/^https?:\/\//i.test(l.href));
  const missing = [];
  for (const l of local) {
    const href = l.href.split("#")[0];
    if (!href) continue;
    const p = path.join(root, href);
    if (!fs.existsSync(p)) missing.push(href);
  }
  return { ok: missing.length === 0, missing };
}

function osfMinStatusForRequired(osf, minStatus, statusOrder) {
  // Heuristic: treat rows containing "[PROD]" or "Production" as required.
  // If your OSF uses different tagging, adjust this logic.
  if (!osf.ok) return { ok: false, reason: osf.error || "OSF parse failed" };
  const minIdx = statusOrder.indexOf(minStatus);
  if (minIdx < 0) return { ok: false, reason: "Unknown min status" };

  const required = osf.rows.filter(r => /\bPROD\b|\bProduction\b/i.test(r.raw));
  const bad = [];
  for (const r of required) {
    const idx = statusOrder.indexOf(r.status);
    if (idx < minIdx) bad.push({ status: r.status, raw: r.raw });
  }
  return { ok: bad.length === 0, badCount: bad.length };
}

function evaluateCheck(ctx, check) {
  const { root, cfg, liveIndex, evidenceLinks, osf, e2e } = ctx;
  const type = check.type;

  // 1) filesystem checks
  if (type === "fileExists") return { checkType: type, ...((existsFile(root, check.path)) ? pass("present") : fail("missing: " + check.path)) };
  if (type === "dirExists") return { checkType: type, ...((existsDir(root, check.path)) ? pass("present") : fail("missing: " + check.path)) };
  if (type === "anyFileExists") {
    const ok = (check.paths || []).some(p => fs.existsSync(path.join(root, p)));
    return { checkType: type, ...(ok ? pass("present") : fail("missing all: " + (check.paths || []).join(", "))) };
  }
  if (type === "fileRegex") {
    const ok = fileRegex(root, check.path, check.pattern);
    return { checkType: type, ...(ok ? pass("matched") : fail("pattern not found")) };
  }
  if (type === "jsonHasPath") {
    const ok = jsonHasPath(root, check.path, check.jsonPointer);
    return { checkType: type, ...(ok ? pass("present") : fail("missing json pointer: " + check.jsonPointer)) };
  }
  if (type === "dockerComposeHasServices") {
    const ok = dockerComposeHasServices(root, check.path, check.services || []);
    return { checkType: type, ...(ok ? pass("services present") : fail("missing services in compose")) };
  }

  // 2) package.json scripts
  if (type === "packageJsonHasAllScripts") {
    const ok = packageJsonHasAllScripts(root, check.scripts || []);
    return { checkType: type, ...(ok ? pass("present") : fail("missing scripts: " + (check.scripts || []).join(", "))) };
  }
  if (type === "packageJsonHasAnyScript") {
    const ok = packageJsonHasAnyScript(root, check.scripts || []);
    return { checkType: type, ...(ok ? pass("present") : fail("none present: " + (check.scripts || []).join(", "))) };
  }

  // 3) live suite checks
  if (type === "liveCommandPass") {
    const r = liveIndex[check.id];
    if (!r) return skip("live result not found for " + check.id);
    return { checkType: type, ...(r.status === "PASS" ? pass("ok") : fail("failed: " + check.id)) };
  }
  if (type === "liveCommandPassAny") {
    const ids = check.ids || [];
    const found = ids.map(id => ({ id, r: liveIndex[id] })).filter(x => !!x.r);
    if (!found.length) return skip("no live results found for any: " + ids.join(", "));
    const ok = found.some(x => x.r.status === "PASS");
    return { checkType: type, ...(ok ? pass("ok") : fail("none passed: " + ids.join(", "))) };
  }

  // 4) E2E contract checks
  if (type === "e2eContractPass") {
    if (!e2e) return skip("e2e not executed (run with --full or --all)");
    const t = (e2e.tests || []).find(x => x.id === check.contractId);
    if (!t) return skip("contract not found: " + check.contractId);
    return { checkType: type, ...(t.status === "PASS" ? pass("ok") : fail("failed")) };
  }

  // 5) evidence checks
  if (type === "evidenceLatestNoSecretPatterns") {
    const evPath = evidenceLatestPath(root, cfg.paths.evidenceDir);
    if (!evPath) return skip("no evidence md found under " + cfg.paths.evidenceDir);
    const txt = fs.readFileSync(evPath, "utf8");
    const ok = evidenceNoSecretPatterns(txt);
    return { checkType: type, ...(ok ? pass("ok") : fail("potential secret patterns found in " + path.relative(root, evPath))) };
  }

  // 6) OSF checks
  if (type === "osfEvidenceLinksResolve") {
    const r = osfEvidenceLinksResolve(root, evidenceLinks || []);
    return { checkType: type, ...(r.ok ? pass("ok") : fail("missing: " + r.missing.slice(0, 10).join(", "))) };
  }
  if (type === "osfMinStatusForRequired") {
    const r = osfMinStatusForRequired(osf, check.minStatus, cfg.statusOrder);
    return { checkType: type, ...(r.ok ? pass("ok") : fail("required controls below min status: " + String(r.badCount || 0))) };
  }

  return { checkType: type, ...fail("unknown check type") };
}

module.exports = { evaluateCheck };
