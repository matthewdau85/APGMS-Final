/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

function nowIso() {
  return new Date().toISOString();
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function safeJsonParse(str, p) {
  try { return JSON.parse(str); }
  catch (e) { throw new Error(`Failed to parse JSON: ${p}: ${e.message}`); }
}

function exists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function capString(s, max = 50000) {
  if (s == null) return "";
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n...[truncated]...";
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const eq = a.indexOf("=");
    const key = (eq > -1 ? a.slice(2, eq) : a.slice(2)).trim();
    const val = (eq > -1 ? a.slice(eq + 1) : null);
    if (val !== null) out[key] = val;
    else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

// Minimal JSON Pointer resolver supporting /a/b/0
function jsonPointerHas(obj, ptr) {
  if (ptr === "" || ptr === "/") return true;
  if (!ptr.startsWith("/")) return false;
  const parts = ptr.split("/").slice(1).map(p => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return false;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return false;
      cur = cur[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, part)) return false;
      cur = cur[part];
    }
  }
  return true;
}

function resolvePath(baseKind, repoRoot, assessorRoot, rel) {
  const clean = rel.replace(/^[.][\\/]/, "");
  if (baseKind === "assessor") return path.resolve(assessorRoot, clean);
  return path.resolve(repoRoot, clean);
}

function runCmd(cmd, opts) {
  const start = Date.now();
  const res = { cmd, ok: false, exitCode: null, durationMs: null, stdout: "", stderr: "", error: null };
  try {
    const r = cp.spawnSync(cmd, { shell: true, cwd: opts.cwd, env: opts.env, timeout: opts.timeoutMs || 0, encoding: "utf8" });
    res.exitCode = r.status;
    res.stdout = capString(r.stdout || "");
    res.stderr = capString(r.stderr || "");
    res.ok = (r.status === 0);
    if (r.error) res.error = String(r.error.message || r.error);
  } catch (e) {
    res.error = String(e && e.message ? e.message : e);
  } finally {
    res.durationMs = Date.now() - start;
  }
  return res;
}

function loadRequirements(reqPath) {
  const raw = readText(reqPath);
  const data = safeJsonParse(raw, reqPath);
  if (!data || !Array.isArray(data.requirements)) throw new Error("requirements file missing 'requirements' array");
  return data;
}

function computeSuites(args) {
  if (args.production) return "production";
  if (args.all || args.full) return "all";
  return "fast";
}

function statusRank(s) {
  // For summaries; PASS > WARN > SKIP > FAIL
  if (s === "PASS") return 3;
  if (s === "WARN") return 2;
  if (s === "SKIP") return 1;
  return 0;
}

function mergeReqStages(req) {
  // Normalize to { prototype: [...], production: [...] }
  const out = { prototype: [], production: [] };
  if (req.checks && typeof req.checks === "object") {
    if (Array.isArray(req.checks.prototype)) out.prototype = req.checks.prototype;
    if (Array.isArray(req.checks.production)) out.production = req.checks.production;
  } else if (Array.isArray(req.checks)) {
    // Back-compat: single list applies to both
    out.prototype = req.checks;
    out.production = req.checks;
  }
  return out;
}

function shouldApplyToStage(req, stage) {
  const st = req.stage;
  if (!st) return true;
  if (Array.isArray(st)) return st.includes(stage);
  return String(st) === stage;
}

function checkResultTemplate(type) {
  return { type, status: "SKIP", note: "", evidence: null };
}

function evalStaticCheck(chk, repoRoot, assessorRoot) {
  const type = chk.type;
  const baseKind = chk.base === "assessor" ? "assessor" : "repo";
  const out = checkResultTemplate(type);

  if (type === "fileExists") {
    const p = resolvePath(baseKind, repoRoot, assessorRoot, chk.path);
    out.evidence = { path: chk.path, resolved: p };
    out.status = exists(p) ? "PASS" : "FAIL";
    out.note = out.status === "PASS" ? "present" : `missing: ${chk.path}`;
    return out;
  }

  if (type === "anyFileExists") {
    const paths = Array.isArray(chk.paths) ? chk.paths : [];
    const resolved = paths.map(x => ({ path: x, resolved: resolvePath(baseKind, repoRoot, assessorRoot, x), ok: exists(resolvePath(baseKind, repoRoot, assessorRoot, x)) }));
    out.evidence = { paths: resolved };
    const ok = resolved.some(r => r.ok);
    out.status = ok ? "PASS" : "FAIL";
    out.note = ok ? "at least one present" : `none present: ${paths.join(", ")}`;
    return out;
  }

  if (type === "fileRegex") {
    const p = resolvePath(baseKind, repoRoot, assessorRoot, chk.path);
    out.evidence = { path: chk.path, resolved: p, pattern: chk.pattern };
    if (!exists(p)) { out.status = "FAIL"; out.note = `missing: ${chk.path}`; return out; }
    const txt = readText(p);
    const re = new RegExp(chk.pattern, chk.flags || "m");
    out.status = re.test(txt) ? "PASS" : "FAIL";
    out.note = out.status === "PASS" ? "pattern found" : "pattern not found";
    return out;
  }

  if (type === "jsonHasPath") {
    const p = resolvePath(baseKind, repoRoot, assessorRoot, chk.path);
    out.evidence = { path: chk.path, resolved: p, pointer: chk.pointer };
    if (!exists(p)) { out.status = "FAIL"; out.note = `missing: ${chk.path}`; return out; }
    const obj = safeJsonParse(readText(p), chk.path);
    out.status = jsonPointerHas(obj, chk.pointer) ? "PASS" : "FAIL";
    out.note = out.status === "PASS" ? "pointer present" : `missing json pointer: ${chk.pointer}`;
    return out;
  }

  if (type === "packageJsonScript") {
    const p = resolvePath("repo", repoRoot, assessorRoot, chk.path || "package.json");
    out.evidence = { path: chk.path || "package.json", resolved: p, script: chk.script };
    if (!exists(p)) { out.status = "FAIL"; out.note = `missing: ${chk.path || "package.json"}`; return out; }
    const obj = safeJsonParse(readText(p), p);
    const scripts = (obj && obj.scripts) ? obj.scripts : {};
    out.status = Object.prototype.hasOwnProperty.call(scripts, chk.script) ? "PASS" : "FAIL";
    out.note = out.status === "PASS" ? "script present" : `missing npm script: ${chk.script}`;
    return out;
  }

  if (type === "workflowExists") {
    const p = resolvePath("repo", repoRoot, assessorRoot, chk.path);
    out.evidence = { path: chk.path, resolved: p };
    out.status = exists(p) ? "PASS" : "FAIL";
    out.note = out.status === "PASS" ? "present" : `missing: ${chk.path}`;
    return out;
  }

  // Unsupported types become WARN rather than silently failing.
  out.status = "WARN";
  out.note = `unsupported static check type: ${type}`;
  return out;
}

function evalLiveCheck(chk, liveResults, suite) {
  const type = chk.type;
  const out = checkResultTemplate(type);

  if (type !== "liveCommandPass") {
    out.status = "WARN";
    out.note = `unsupported live check type: ${type}`;
    return out;
  }

  const cmdId = chk.commandId;
  out.evidence = { commandId: cmdId };

  const lr = liveResults[cmdId];
  if (!lr) {
    // If this live command is not part of the suite, it should be SKIP (non-blocking) unless explicitly required.
    out.status = "SKIP";
    out.note = `not executed (suite=${suite})`;
    return out;
  }

  out.status = lr.ok ? "PASS" : "FAIL";
  out.note = lr.ok ? "command ok" : `command failed (exit=${lr.exitCode})`;
  return out;
}

function requirementOutcome(checks) {
  // If any FAIL => FAIL; else if any WARN => WARN; else if any PASS => PASS; else SKIP
  let best = "SKIP";
  for (const c of checks) {
    if (c.status === "FAIL") return "FAIL";
    if (c.status === "WARN") best = (best === "PASS") ? "PASS" : "WARN";
    if (c.status === "PASS") best = "PASS";
  }
  return best;
}

function summarizeBlockers(live) {
  const blockers = [];
  const typecheck = live.typecheck;
  if (typecheck && !typecheck.ok) {
    blockers.push({
      kind: "typecheck",
      headline: "TypeScript typecheck failing",
      detail: (typecheck.stderr || typecheck.stdout || "").split("\n").slice(0, 25).join("\n")
    });
  }
  const apiTests = live.api_gateway_tests;
  if (apiTests && !apiTests.ok) {
    blockers.push({
      kind: "tests",
      headline: "API gateway unit tests failing",
      detail: (apiTests.stderr || apiTests.stdout || "").split("\n").slice(0, 35).join("\n")
    });
  }
  const readiness = live.readiness_all;
  if (readiness && !readiness.ok) {
    blockers.push({
      kind: "readiness",
      headline: "Readiness checks failing",
      detail: (readiness.stderr || readiness.stdout || "").split("\n").slice(0, 35).join("\n")
    });
  }
  return blockers;
}

function computeSummaries(reqResults, pillars, processes, stage) {
  const byPillar = {};
  const byProcess = {};

  for (const p of pillars) byPillar[p.id] = { pillar: p.id, name: p.name, stage, pass: 0, fail: 0, warn: 0, skip: 0, total: 0, score: 0 };
  for (const pr of processes) byProcess[pr.id] = { process: pr.id, name: pr.name, stage, pass: 0, fail: 0, warn: 0, skip: 0, total: 0, score: 0, pillars: {} };

  for (const r of reqResults) {
    if (r.stage !== stage) continue;

    const ps = byPillar[r.pillar] || (byPillar[r.pillar] = { pillar: r.pillar, name: r.pillar, stage, pass: 0, fail: 0, warn: 0, skip: 0, total: 0, score: 0 });
    ps.total++;
    if (r.status === "PASS") ps.pass++;
    else if (r.status === "FAIL") ps.fail++;
    else if (r.status === "WARN") ps.warn++;
    else ps.skip++;

    const weight = (typeof r.weight === "number" && r.weight > 0) ? r.weight : 1;
    ps.score += (r.status === "PASS" ? 1 : 0) * weight;

    const procIds = Array.isArray(r.processes) && r.processes.length ? r.processes : ["_unmapped"];
    for (const pid of procIds) {
      const pr = byProcess[pid] || (byProcess[pid] = { process: pid, name: pid, stage, pass: 0, fail: 0, warn: 0, skip: 0, total: 0, score: 0, pillars: {} });
      pr.total++;
      if (r.status === "PASS") pr.pass++;
      else if (r.status === "FAIL") pr.fail++;
      else if (r.status === "WARN") pr.warn++;
      else pr.skip++;
      pr.score += (r.status === "PASS" ? 1 : 0) * weight;
      pr.pillars[r.pillar] = pr.pillars[r.pillar] || { pass: 0, fail: 0, warn: 0, skip: 0, total: 0 };
      const cell = pr.pillars[r.pillar];
      cell.total++;
      if (r.status === "PASS") cell.pass++;
      else if (r.status === "FAIL") cell.fail++;
      else if (r.status === "WARN") cell.warn++;
      else cell.skip++;
    }
  }

  // Normalize scores to 0..1
  for (const k of Object.keys(byPillar)) {
    const s = byPillar[k];
    const denom = s.pass + s.fail + s.warn + s.skip;
    s.score = denom ? (s.pass / denom) : 0;
  }
  for (const k of Object.keys(byProcess)) {
    const s = byProcess[k];
    const denom = s.pass + s.fail + s.warn + s.skip;
    s.score = denom ? (s.pass / denom) : 0;
  }

  return { byPillar, byProcess };
}

function renderMarkdownReport(report) {
  const lines = [];
  lines.push(`# APGMS Assessment Report (v3)\n`);
  lines.push(`- Timestamp: ${report.meta.timestamp}`);
  lines.push(`- Repo root: ${report.meta.repoRoot}`);
  lines.push(`- Assessor root: ${report.meta.assessorRoot}`);
  lines.push(`- Suite: ${report.meta.suite}\n`);

  for (const stage of ["prototype", "production"]) {
    const sum = report.summaries[stage];
    lines.push(`## ${stage[0].toUpperCase() + stage.slice(1)} readiness\n`);
    lines.push(`Overall: ${Math.round(report.overall[stage].score * 100)}% (PASS ${report.overall[stage].pass} / TOTAL ${report.overall[stage].total})\n`);

    lines.push(`### Pillars\n`);
    lines.push(`| Pillar | Score | PASS | FAIL | WARN | SKIP |`);
    lines.push(`|---|---:|---:|---:|---:|---:|`);
    for (const p of report.pillars) {
      const s = sum.byPillar[p.id] || { score: 0, pass: 0, fail: 0, warn: 0, skip: 0 };
      lines.push(`| ${p.name} | ${Math.round(s.score * 100)}% | ${s.pass} | ${s.fail} | ${s.warn} | ${s.skip} |`);
    }
    lines.push("");

    const blockers = report.blockers[stage];
    if (blockers.length) {
      lines.push(`### Blocking defects (from live checks)\n`);
      for (const b of blockers) {
        lines.push(`- **${b.headline}**`);
        if (b.detail) lines.push("```", b.detail, "```");
      }
      lines.push("");
    }

    lines.push(`### Highest-impact next actions\n`);
    const actions = report.actions[stage].slice(0, 12);
    if (!actions.length) lines.push(`(No actions generated)\n`);
    else {
      for (const a of actions) {
        lines.push(`- [${a.pillar}] ${a.requirementId}: ${a.note}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderProcessMarkdown(report) {
  const lines = [];
  lines.push(`# APGMS Pillar x Process Breakdown (v3)\n`);
  lines.push(`- Timestamp: ${report.meta.timestamp}`);
  lines.push(`- Suite: ${report.meta.suite}\n`);

  for (const stage of ["prototype", "production"]) {
    const sum = report.summaries[stage];
    lines.push(`## ${stage[0].toUpperCase() + stage.slice(1)}\n`);
    lines.push(`| Process | Score | PASS | FAIL | WARN | SKIP |`);
    lines.push(`|---|---:|---:|---:|---:|---:|`);
    const procList = report.processes.filter(p => p.stage === stage || p.stage === "both");
    for (const pr of procList) {
      const s = sum.byProcess[pr.id] || { score: 0, pass: 0, fail: 0, warn: 0, skip: 0 };
      lines.push(`| ${pr.name} | ${Math.round(s.score * 100)}% | ${s.pass} | ${s.fail} | ${s.warn} | ${s.skip} |`);
    }
    lines.push("");

    // Matrix: process rows, pillar columns (PASS/FAIL counts)
    lines.push(`### Matrix (process -> pillar)\n`);
    const pillars = report.pillars;
    lines.push(`| Process \\ Pillar | ${pillars.map(p => p.name).join(" | ")} |`);
    lines.push(`|---|${pillars.map(() => "---:").join("|")}|`);
    for (const pr of procList) {
      const s = sum.byProcess[pr.id] || { pillars: {} };
      const cells = pillars.map(p => {
        const cell = (s.pillars && s.pillars[p.id]) ? s.pillars[p.id] : null;
        if (!cell || !cell.total) return "—";
        // show PASS/TOTAL
        return `${cell.pass}/${cell.total}`;
      });
      lines.push(`| ${pr.name} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const suite = computeSuites(args);

  const repoRoot = process.cwd();
  const assessorRoot = path.resolve(__dirname, "..", ".."); // .../scripts/assessor -> .../assessor-10of10-v3

  const reqPath = args.req || path.join(assessorRoot, "docs", "assessor", "requirements.v3.json");
  const outdir = path.resolve(repoRoot, args.outdir || "assessment/reports");
  const noFail = Boolean(args["no-fail"] || args.nofail);

  const reqDoc = loadRequirements(reqPath);
  const pillars = Array.isArray(reqDoc.pillars) ? reqDoc.pillars : [];
  const processes = Array.isArray(reqDoc.processes) ? reqDoc.processes : [];

  const liveCommands = Array.isArray(reqDoc.liveCommands) ? reqDoc.liveCommands : [];
  const liveToRun = liveCommands.filter(c => {
    const suites = Array.isArray(c.suites) ? c.suites : ["all"];
    if (suite === "fast") return suites.includes("fast");
    if (suite === "production") return suites.includes("production");
    return suites.includes("all");
  });

  const live = {};
  for (const c of liveToRun) {
    console.log(`[assess] running: ${c.cmd}`);
    live[c.id] = runCmd(c.cmd, { cwd: repoRoot, env: process.env, timeoutMs: c.timeoutMs || 0 });
  }

  const reqResults = [];
  const actions = { prototype: [], production: [] };

  for (const req of reqDoc.requirements) {
    const stages = ["prototype", "production"];
    const checksByStage = mergeReqStages(req);

    for (const stage of stages) {
      if (!shouldApplyToStage(req, stage)) continue;

      const checks = [];
      const chkList = (stage === "prototype" ? checksByStage.prototype : checksByStage.production) || [];
      for (const chk of chkList) {
        if (!chk || !chk.type) continue;
        if (chk.type === "liveCommandPass") checks.push(evalLiveCheck(chk, live, suite));
        else checks.push(evalStaticCheck(chk, repoRoot, assessorRoot));
      }

      const status = requirementOutcome(checks);
      const rr = {
        id: req.id,
        title: req.title || req.id,
        pillar: req.pillar || "unassigned",
        processes: req.processes || [],
        stage,
        weight: typeof req.weight === "number" ? req.weight : 1,
        gate: Boolean(req.gate && req.gate[stage]),
        status,
        checks
      };
      reqResults.push(rr);

      if (status !== "PASS") {
        const failNote = rr.checks.find(c => c.status === "FAIL") || rr.checks.find(c => c.status === "WARN") || rr.checks[0];
        actions[stage].push({
          pillar: rr.pillar,
          requirementId: rr.id,
          note: failNote ? `${failNote.note}` : "not satisfied"
        });
      }
    }
  }

  // Summaries
  const summaries = {
    prototype: computeSummaries(reqResults, pillars, processes, "prototype"),
    production: computeSummaries(reqResults, pillars, processes, "production")
  };

  function overall(stage) {
    const items = reqResults.filter(r => r.stage === stage);
    const total = items.length;
    const pass = items.filter(r => r.status === "PASS").length;
    const score = total ? pass / total : 0;
    return { total, pass, score };
  }

  const report = {
    meta: { timestamp: nowIso(), repoRoot, assessorRoot, suite, requirementsFile: reqPath },
    pillars,
    processes,
    live,
    blockers: {
      prototype: summarizeBlockers(live),
      production: summarizeBlockers(live)
    },
    requirements: reqResults,
    summaries,
    overall: {
      prototype: overall("prototype"),
      production: overall("production")
    },
    actions: {
      prototype: actions.prototype,
      production: actions.production
    }
  };

  mkdirp(outdir);
  const jsonOut = path.join(outdir, "apgms-assess.v3.json");
  const mdOut = path.join(outdir, "apgms-assess.v3.md");
  const procOut = path.join(outdir, "apgms-assess.process.v3.md");

  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(mdOut, renderMarkdownReport(report), "utf8");
  fs.writeFileSync(procOut, renderProcessMarkdown(report), "utf8");

  console.log(`[assess] wrote ${path.relative(repoRoot, jsonOut)}`);
  console.log(`[assess] wrote ${path.relative(repoRoot, mdOut)}`);
  console.log(`[assess] wrote ${path.relative(repoRoot, procOut)}`);

  // Exit behavior: fail CI if any gated requirement failed in the relevant stage(s)
  let exitCode = 0;
  if (!noFail) {
    const gated = reqResults.filter(r => r.gate);
    const gatedFail = gated.filter(r => r.status === "FAIL");
    if (gatedFail.length) exitCode = 2;
  }
  process.exit(exitCode);
}

main();
