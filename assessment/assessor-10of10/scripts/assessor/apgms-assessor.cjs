"use strict";

/*
  APGMS Assessor v2 (10/10 framework)

  - Reads docs/assessor/requirements.v2.json
  - Runs live command suites (fast/full/all)
  - Evaluates static checks + OSF traceability + E2E contract hooks
  - Writes:
      reports/apgms-assess.v2.json
      reports/apgms-assess.v2.md
*/

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const { evaluateCheck } = require("./checks.cjs");
const { parseOsfMatrix, extractEvidenceLinksFromMarkdown } = require("./osf.cjs");
const { runE2EContract } = require("./e2e-runner-lib.cjs");

function isWin() { return process.platform === "win32"; }

function nowIso() { return new Date().toISOString(); }

function safeMkdir(p) { fs.mkdirSync(p, { recursive: true }); }

function readText(p) { return fs.readFileSync(p, "utf8"); }

function loadJson(p) { return JSON.parse(readText(p)); }

function parseArgs(argv) {
  const args = {
    suite: "all",
    mode: "both", // prototype|production|both
    req: "docs/assessor/requirements.v2.json",
    outDir: "reports",
    outJson: "apgms-assess.v2.json",
    outMd: "apgms-assess.v2.md",
    quiet: false
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fast") args.suite = "fast";
    else if (a === "--full") args.suite = "full";
    else if (a === "--all") args.suite = "all";
    else if (a === "--prototype") args.mode = "prototype";
    else if (a === "--production") args.mode = "production";
    else if (a === "--both") args.mode = "both";
    else if (a === "--req" && argv[i + 1]) args.req = argv[++i];
    else if (a === "--outdir" && argv[i + 1]) args.outDir = argv[++i];
    else if (a === "--quiet") args.quiet = true;
  }
  return args;
}

function runCmd(cmd, timeoutMs) {
  const startedAt = nowIso();
  const res = cp.spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    timeout: timeoutMs || 10 * 60 * 1000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const endedAt = nowIso();
  const pass = res.status === 0;

  return {
    cmd,
    startedAt,
    endedAt,
    timeoutMs: timeoutMs || 10 * 60 * 1000,
    status: pass ? "PASS" : "FAIL",
    exitCode: res.status,
    stdout: (res.stdout || "").slice(0, 20000),
    stderr: (res.stderr || "").slice(0, 20000)
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# APGMS Assessment Report (v2)");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Suite: ${report.suite}`);
  lines.push("");

  for (const stage of report.stages) {
    lines.push(`## ${stage.stage.toUpperCase()}`);
    lines.push(`Ready: ${stage.ready ? "YES" : "NO"}`);
    lines.push(`Score: ${(stage.score * 100).toFixed(1)}% (threshold ${(stage.threshold * 100).toFixed(0)}%)`);
    lines.push("");

    if (stage.gatesFailed.length) {
      lines.push("### Gates failed");
      for (const g of stage.gatesFailed) lines.push(`- ${g}`);
      lines.push("");
    }

    lines.push("### Pillars");
    for (const p of stage.pillars) {
      lines.push(`- ${p.name}: ${(p.score * 100).toFixed(0)}% (weightHit ${p.weightHit}/${p.weightTotal})`);
    }
    lines.push("");

    lines.push("### Top actions");
    if (!stage.actions.length) lines.push("- None");
    else for (const a of stage.actions.slice(0, 50)) lines.push(`- ${a}`);
    lines.push("");
  }

  lines.push("## Live command results");
  for (const r of report.liveResults) {
    lines.push(`- ${r.id}: ${r.status} (exit ${r.exitCode})`);
  }
  lines.push("");

  lines.push("## OSF summary");
  if (!report.osf.ok) lines.push(`- OSF parse failed: ${report.osf.error}`);
  else {
    for (const k of Object.keys(report.osf.counts || {})) {
      lines.push(`- ${k}: ${report.osf.counts[k]}`);
    }
  }
  lines.push("");

  lines.push("## E2E contract summary");
  if (!report.e2e) lines.push("- Not executed");
  else {
    lines.push(`- status: ${report.e2e.status}`);
    for (const t of report.e2e.tests || []) {
      lines.push(`  - ${t.name}: ${t.status}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const root = process.cwd();

  const reqPath = path.join(root, args.req);
  if (!fs.existsSync(reqPath)) {
    console.error(`[assess] Missing requirements file: ${args.req}`);
    process.exit(2);
  }

  const cfg = loadJson(reqPath);

  // Parse OSF matrix and evidence indexes (best-effort)
  const osfMatrixPath = path.join(root, cfg.paths.osfMatrix);
  const osfEvidencePaths = (cfg.paths.osfEvidenceIndexes || []).map(p => path.join(root, p));

  const osf = parseOsfMatrix(osfMatrixPath, cfg.statusOrder);
  let evidenceLinks = [];
  for (const p of osfEvidencePaths) {
    if (fs.existsSync(p)) {
      evidenceLinks = evidenceLinks.concat(extractEvidenceLinksFromMarkdown(readText(p)));
    }
  }

  // Live commands
  const suite = cfg.liveSuites[args.suite] || [];
  const liveResults = [];
  const liveIndex = {};
  for (const c of suite) {
    if (!args.quiet) console.log(`[assess] running: ${c.cmd}`);
    const r = runCmd(c.cmd, c.timeoutMs);
    liveResults.push({ id: c.id, ...r });
    liveIndex[c.id] = r;
  }

  // E2E contracts: always run smoke/authBoundaries in full/all (best effort)
  let e2e = null;
  if (args.suite !== "fast") {
    try {
      e2e = runE2EContract(path.join(root, "docs/assessor/contracts/e2e-contract.json"));
    } catch (err) {
      e2e = { status: "FAIL", error: String(err), tests: [] };
    }
  }

  const stages = (args.mode === "both") ? ["prototype","production"] : [args.mode];

  const stageReports = [];
  for (const stage of stages) {
    const threshold = (cfg.thresholds && cfg.thresholds[stage]) || 0.9;
    const skipCountsAsFail = cfg.stages && cfg.stages[stage] && cfg.stages[stage].skipCountsAsFail;

    let weightHit = 0;
    let weightTotal = 0;
    const pillarOut = [];
    const actions = [];
    const gatesFailed = [];

    for (const pillar of cfg.pillars || []) {
      let pWeightHit = 0;
      let pWeightTotal = 0;

      for (const req of pillar.requirements || []) {
        const spec = req[stage] || {};
        if (!spec.required) continue;

        const weight = Number(req.weight || 1);
        weightTotal += weight;
        pWeightTotal += weight;

        const ctx = {
          root,
          stage,
          cfg,
          req,
          liveIndex,
          osf,
          evidenceLinks,
          e2e
        };

        const checks = req.checks || [];
        const results = checks.map(ch => evaluateCheck(ctx, ch));

        const statusList = results.map(r => r.status);
        const allPass = statusList.every(s => s === "PASS");
        const anySkip = statusList.some(s => s === "SKIP");
        const ok = allPass && (!anySkip || !skipCountsAsFail);

        if (ok) {
          weightHit += weight;
          pWeightHit += weight;
        } else {
          actions.push(`[${pillar.id}/${req.id}] ${req.title}`);
          for (const r of results) {
            if (r.status !== "PASS") actions.push(`  - ${r.checkType}: ${r.status} ${r.detail}`);
          }
          if (spec.gate || req.gate) {
            gatesFailed.push(`${pillar.id}/${req.id}: ${req.title}`);
          }
        }
      }

      const pScore = pWeightTotal ? (pWeightHit / pWeightTotal) : 1;
      pillarOut.push({
        id: pillar.id,
        name: pillar.name,
        score: pScore,
        weightHit: pWeightHit,
        weightTotal: pWeightTotal
      });
    }

    const score = weightTotal ? (weightHit / weightTotal) : 1;
    const ready = (score >= threshold) && (gatesFailed.length === 0);

    stageReports.push({
      stage,
      threshold,
      score,
      ready,
      pillars: pillarOut,
      actions,
      gatesFailed
    });
  }

  const report = {
    generatedAt: nowIso(),
    suite: args.suite,
    repoRoot: root,
    osf: {
      ok: osf.ok,
      error: osf.error || null,
      counts: osf.counts || {}
    },
    liveResults,
    e2e,
    stages: stageReports
  };

  safeMkdir(path.join(root, args.outDir));
  const outJsonPath = path.join(root, args.outDir, args.outJson);
  const outMdPath = path.join(root, args.outDir, args.outMd);

  fs.writeFileSync(outJsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  fs.writeFileSync(outMdPath, buildMarkdown(report), "utf8");

  if (!args.quiet) {
    console.log(`[assess] wrote ${path.relative(root, outJsonPath)}`);
    console.log(`[assess] wrote ${path.relative(root, outMdPath)}`);
  }

  const anyNotReady = stageReports.some(s => !s.ready);
  process.exit(anyNotReady ? 2 : 0);
}

main();
