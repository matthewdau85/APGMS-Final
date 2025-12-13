"use strict";

const fs = require("fs");
const path = require("path");

function usage(msg) {
  if (msg) console.error("[breakdown] " + msg);
  console.error(
    "Usage: node process-breakdown.cjs " +
      "--req <requirements.json> " +
      "--report <apgms-assess.v2.json> " +
      "--outdir <dir> " +
      "[--repoRoot <dir>] " +
      "[--evidenceRoot <dir>]"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) usage("Bad arg: " + a);
    const k = a.slice(2);
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) usage("Missing value for --" + k);
    out[k] = v;
    i++;
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function collectRequirements(root) {
  const reqs = [];

  function walk(node) {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!isObject(node)) return;

    // Heuristic: a requirement-like object has id + (checks or prototype/production blocks)
    const hasId = typeof node.id === "string" && node.id.includes("/");
    const hasChecks = Array.isArray(node.checks);
    const hasStageBlocks =
      isObject(node.prototype) ||
      isObject(node.production) ||
      isObject(node.stages);

    if (hasId && (hasChecks || hasStageBlocks)) {
      reqs.push(node);
      return;
    }

    for (const k of Object.keys(node)) walk(node[k]);
  }

  walk(root);
  return reqs;
}

function pct(n) {
  return Math.round(n * 1000) / 10;
}

function titleize(s) {
  return String(s || "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonPointerGet(obj, pointer) {
  // Supports RFC6901-ish pointers like /a/b/0
  if (pointer === "" || pointer === "/") return obj;
  const parts = pointer.split("/").slice(1).map(p => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return { ok: false, reason: "null at segment " + part };
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) {
        return { ok: false, reason: "bad index " + part };
      }
      cur = cur[idx];
    } else if (typeof cur === "object") {
      if (!(part in cur)) return { ok: false, reason: "missing key " + part };
      cur = cur[part];
    } else {
      return { ok: false, reason: "non-object at segment " + part };
    }
  }
  return { ok: true, value: cur };
}

function normalizeStageBlock(req, stage) {
  // Supports multiple shapes:
  // 1) {id, checks:[...], weight:{prototype:.., production:..}}
  // 2) {id, prototype:{checks:[...], weight:..}, production:{...}}
  // 3) {id, stages:{prototype:{checks:[...]} ...}}
  const base = {
    id: req.id,
    title: req.title || req.name || "",
    pillar: req.pillar || req.pillarId || null,
    process: req.process || req.processId || null,
    weight: req.weight,
    checks: req.checks
  };

  if (isObject(req.stages) && isObject(req.stages[stage])) {
    const blk = req.stages[stage];
    return {
      ...base,
      title: blk.title || base.title,
      pillar: blk.pillar || base.pillar,
      process: blk.process || base.process,
      weight: blk.weight != null ? blk.weight : base.weight,
      checks: Array.isArray(blk.checks) ? blk.checks : base.checks
    };
  }

  if (isObject(req[stage])) {
    const blk = req[stage];
    return {
      ...base,
      title: blk.title || base.title,
      pillar: blk.pillar || base.pillar,
      process: blk.process || base.process,
      weight: blk.weight != null ? blk.weight : base.weight,
      checks: Array.isArray(blk.checks) ? blk.checks : base.checks
    };
  }

  return base;
}

function weightForStage(w, stage) {
  if (typeof w === "number") return w;
  if (isObject(w)) {
    if (typeof w[stage] === "number") return w[stage];
    if (typeof w.default === "number") return w.default;
  }
  return 1;
}

function inferPillarId(reqId, explicit) {
  if (explicit && typeof explicit === "string") return explicit;
  const parts = String(reqId).split("/");
  return parts[0] || "unknown";
}

function inferProcessId(reqId, explicit) {
  if (explicit && typeof explicit === "string") return explicit;
  const parts = String(reqId).split("/");
  return parts[1] || "general";
}

function defaultScopeForRelPath(rel) {
  // Evidence pack convention: docs/, infra/, scripts/assessor/* are evidence artifacts.
  // Repo convention: services/, packages/, worker/, webapp/, .github/, etc are implementation artifacts.
  const p = rel.replace(/\\/g, "/");
  if (p.startsWith("docs/")) return "evidence";
  if (p.startsWith("infra/")) return "evidence";
  if (p.startsWith("scripts/assessor/")) return "evidence";
  if (p.startsWith("scripts/assessor-")) return "evidence";
  return "repo";
}

function resolvePath(repoRoot, evidenceRoot, rel, scope) {
  if (!rel) return null;
  if (path.isAbsolute(rel)) return rel;
  const sc = scope || defaultScopeForRelPath(rel);
  const root = sc === "evidence" ? evidenceRoot : repoRoot;
  return path.resolve(root, rel);
}

function evalCheck(repoRoot, evidenceRoot, liveMap, check) {
  const type = check.type || check.kind || check.check;
  const t = String(type || "").trim();

  // LIVE checks
  if (t === "liveCommandPass") {
    const id = check.liveId || check.id;
    const lr = id ? liveMap.get(id) : null;
    if (!lr) return { status: "SKIP", detail: "live result not found for " + (id || "(missing id)") };
    return lr.status === "PASS" || lr.exitCode === 0
      ? { status: "PASS", detail: "live " + id + " passed" }
      : { status: "FAIL", detail: "live " + id + " failed (exit " + lr.exitCode + ")" };
  }

  if (t === "liveCommandPassAny") {
    const ids = check.anyOf || check.ids || check.liveIds;
    const list = Array.isArray(ids) ? ids : [];
    const found = list.map(x => ({ id: x, lr: liveMap.get(x) })).filter(x => x.lr);
    if (found.length === 0) return { status: "SKIP", detail: "live results not found for any: " + list.join(", ") };
    for (const x of found) {
      if (x.lr.status === "PASS" || x.lr.exitCode === 0) return { status: "PASS", detail: "live " + x.id + " passed" };
    }
    return { status: "FAIL", detail: "none passed: " + found.map(x => x.id).join(", ") };
  }

  // FILE checks
  if (t === "fileExists") {
    const rel = check.path || check.file;
    const abs = resolvePath(repoRoot, evidenceRoot, rel, check.scope);
    if (!abs) return { status: "FAIL", detail: "missing path" };
    return fs.existsSync(abs)
      ? { status: "PASS", detail: "exists: " + rel }
      : { status: "FAIL", detail: "missing: " + rel };
  }

  if (t === "anyFileExists") {
    const rels = check.paths || check.anyOf || [];
    const list = Array.isArray(rels) ? rels : [];
    if (list.length === 0) return { status: "FAIL", detail: "missing paths list" };
    for (const rel of list) {
      const abs = resolvePath(repoRoot, evidenceRoot, rel, check.scope);
      if (abs && fs.existsSync(abs)) return { status: "PASS", detail: "found: " + rel };
    }
    return { status: "FAIL", detail: "missing all: " + list.join(", ") };
  }

  if (t === "fileRegex") {
    const rel = check.path || check.file;
    const pattern = check.pattern || check.regex;
    const flags = check.flags || "m";
    const abs = resolvePath(repoRoot, evidenceRoot, rel, check.scope);
    if (!abs || !fs.existsSync(abs)) return { status: "FAIL", detail: "missing: " + (rel || "(no file)") };
    if (!pattern) return { status: "FAIL", detail: "missing regex pattern" };
    const re = new RegExp(pattern, flags);
    const txt = fs.readFileSync(abs, "utf8");
    return re.test(txt)
      ? { status: "PASS", detail: "pattern found" }
      : { status: "FAIL", detail: "pattern not found" };
  }

  if (t === "jsonHasPath") {
    const rel = check.path || check.file || check.jsonFile;
    const pointer = check.pointer || check.jsonPointer || check.jsonPath;
    const abs = resolvePath(repoRoot, evidenceRoot, rel, check.scope);
    if (!abs || !fs.existsSync(abs)) return { status: "FAIL", detail: "missing: " + (rel || "(no json file)") };
    if (!pointer) return { status: "FAIL", detail: "missing json pointer" };
    const obj = readJson(abs);
    const got = jsonPointerGet(obj, pointer);
    return got.ok
      ? { status: "PASS", detail: "json pointer present: " + pointer }
      : { status: "FAIL", detail: "missing json pointer: " + pointer + " (" + got.reason + ")" };
  }

  // Unknown check types should not silently pass.
  return { status: "SKIP", detail: "unsupported check type: " + (t || "(missing)") };
}

function evalRequirement(repoRoot, evidenceRoot, liveMap, req, stage) {
  const r = normalizeStageBlock(req, stage);
  const checks = Array.isArray(r.checks) ? r.checks : [];
  const outChecks = checks.map(ch => {
    const res = evalCheck(repoRoot, evidenceRoot, liveMap, ch);
    return { ...res, type: ch.type || ch.kind || ch.check || "unknown" };
  });

  let status = "PASS";
  for (const c of outChecks) {
    if (c.status === "FAIL") { status = "FAIL"; break; }
    if (c.status === "SKIP") status = "SKIP";
  }

  const pillarId = inferPillarId(r.id, r.pillar);
  const processId = inferProcessId(r.id, r.process);
  const w = weightForStage(r.weight, stage);

  return {
    id: r.id,
    title: r.title || titleize(processId),
    stage,
    pillarId,
    processId,
    weight: w,
    status,
    checks: outChecks
  };
}

function summarize(items) {
  let hit = 0, total = 0, pass = 0, fail = 0, skip = 0;
  for (const it of items) {
    total += it.weight;
    if (it.status === "PASS") { hit += it.weight; pass++; }
    else if (it.status === "FAIL") fail++;
    else skip++;
  }
  return {
    weightHit: hit,
    weightTotal: total,
    score: total > 0 ? hit / total : 0,
    pass, fail, skip
  };
}

function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

(function main() {
  const args = parseArgs(process.argv);
  if (!args.req || !args.report || !args.outdir) usage("Missing required args");

  const repoRoot = path.resolve(args.repoRoot || process.cwd());
  const evidenceRoot = path.resolve(repoRoot, args.evidenceRoot || "."); // default: repoRoot
  const reqPath = path.resolve(repoRoot, args.req);
  const reportPath = path.resolve(repoRoot, args.report);
  const outdir = path.resolve(repoRoot, args.outdir);

  if (!fs.existsSync(reqPath)) usage("requirements file not found: " + reqPath);
  if (!fs.existsSync(reportPath)) usage("report json not found: " + reportPath);

  const reqDoc = readJson(reqPath);
  const rawReqs = collectRequirements(reqDoc);

  const report = readJson(reportPath);
  const liveMap = new Map();
  for (const lr of (report.liveResults || [])) liveMap.set(lr.id, lr);

  const stageMeta = new Map();
  for (const st of (report.stages || [])) {
    stageMeta.set(st.stage, st);
  }

  const stages = ["prototype", "production"];
  const out = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    evidenceRoot,
    reqPath: path.relative(repoRoot, reqPath).replace(/\\/g, "/"),
    reportPath: path.relative(repoRoot, reportPath).replace(/\\/g, "/"),
    stages: {}
  };

  let md = "";
  md += "# APGMS Pillar x Process Breakdown\n";
  md += "Generated: " + out.generatedAt + "\n";
  md += "Repo root: " + repoRoot + "\n";
  md += "Evidence root: " + evidenceRoot + "\n\n";

  for (const stage of stages) {
    const st = stageMeta.get(stage) || {};
    const evaluated = rawReqs.map(r => evalRequirement(repoRoot, evidenceRoot, liveMap, r, stage));

    // Pillar ordering + names (if assessor stage metadata exists)
    const pillarOrder = Array.isArray(st.pillars) ? st.pillars.map(p => p.id) : [];
    const pillarName = new Map();
    if (Array.isArray(st.pillars)) for (const p of st.pillars) pillarName.set(p.id, p.name);

    const byPillar = groupBy(evaluated, r => r.pillarId);

    const pillarKeys = pillarOrder.length
      ? pillarOrder.filter(k => byPillar.has(k)).concat([...byPillar.keys()].filter(k => !pillarOrder.includes(k)))
      : [...byPillar.keys()].sort();

    md += "## " + stage.toUpperCase() + "\n";
    if (typeof st.score === "number" && typeof st.threshold === "number") {
      md += "Overall: " + pct(st.score) + "% (threshold " + pct(st.threshold) + "%) | Ready: " + (st.ready ? "YES" : "NO") + "\n";
    }
    md += "\n";

    // Pillar summary table
    md += "| Pillar | Score | Pass | Fail | Skip |\n";
    md += "|---|---:|---:|---:|---:|\n";

    const pillarSummaries = [];
    for (const pid of pillarKeys) {
      const items = byPillar.get(pid) || [];
      const s = summarize(items);
      const nm = pillarName.get(pid) || titleize(pid);
      pillarSummaries.push({ pid, name: nm, ...s });
      md += "| " + nm + " | " + pct(s.score) + "% | " + s.pass + " | " + s.fail + " | " + s.skip + " |\n";
    }

    md += "\n";

    // Detailed breakdown: pillar -> process
    for (const ps of pillarSummaries) {
      const items = byPillar.get(ps.pid) || [];
      const byProc = groupBy(items, r => r.processId);
      const procKeys = [...byProc.keys()].sort();

      md += "### " + ps.name + "\n";
      md += "| Process | Score | Pass | Fail | Skip |\n";
      md += "|---|---:|---:|---:|---:|\n";

      const procSummaries = [];
      for (const prc of procKeys) {
        const its = byProc.get(prc) || [];
        const s = summarize(its);
        procSummaries.push({ prc, ...s });
        md += "| " + titleize(prc) + " | " + pct(s.score) + "% | " + s.pass + " | " + s.fail + " | " + s.skip + " |\n";
      }

      md += "\n";

      // List failed requirements per process
      for (const p of procSummaries) {
        const its = byProc.get(p.prc) || [];
        const failed = its.filter(x => x.status === "FAIL");
        if (failed.length === 0) continue;

        md += "#### " + titleize(p.prc) + " - FAILURES\n";
        for (const f of failed) {
          const firstFail = (f.checks || []).find(c => c.status === "FAIL") || null;
          const why = firstFail ? (firstFail.type + ": " + firstFail.detail) : "failed";
          md += "- [" + f.id + "] " + (f.title || "") + " -> " + why + "\n";
        }
        md += "\n";
      }
    }

    out.stages[stage] = {
      meta: {
        score: typeof st.score === "number" ? st.score : null,
        threshold: typeof st.threshold === "number" ? st.threshold : null,
        ready: !!st.ready
      },
      pillars: pillarSummaries,
      requirements: evaluated
    };
  }

  fs.mkdirSync(outdir, { recursive: true });
  const outJson = path.join(outdir, "apgms-assess.process.json");
  const outMd = path.join(outdir, "apgms-assess.process.md");
  fs.writeFileSync(outJson, JSON.stringify(out, null, 2) + "\n", "utf8");
  fs.writeFileSync(outMd, md, "utf8");

  console.log("[breakdown] wrote " + path.relative(repoRoot, outJson).replace(/\\/g, "/"));
  console.log("[breakdown] wrote " + path.relative(repoRoot, outMd).replace(/\\/g, "/"));
})();
