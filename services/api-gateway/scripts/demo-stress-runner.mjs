// ASCII only
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  return v === undefined ? fallback : v;
}

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(x)));
}

async function main() {
  const apiBase = String(arg("--apiBase", "http://127.0.0.1:3000")).replace(/\/+$/, "");
  const concurrency = clampInt(arg("--concurrency", "8"), 1, 64);
  const requests = clampInt(arg("--requests", "200"), 1, 20000);
  const outPath = String(arg("--out", ".data/admin-runs/demo-stress-last.json"));

  const routes = [
    "/version",
    "/metrics",
    "/bas/preview",
    "/compliance/report",
    "/alerts",
  ];

  const startedAt = new Date().toISOString();

  const lat = [];
  let ok = 0;
  let fail = 0;

  const makeUrl = (path) => `${apiBase}${path}`;

  async function one(i) {
    const path = routes[i % routes.length];
    const t0 = Date.now();
    try {
      const res = await fetch(makeUrl(path), { method: "GET" });
      const ms = Date.now() - t0;
      lat.push(ms);
      if (res.ok) ok++;
      else fail++;
    } catch {
      const ms = Date.now() - t0;
      lat.push(ms);
      fail++;
    }
  }

  // bounded worker pool
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= requests) return;
      await one(i);
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);

  lat.sort((a, b) => a - b);
  const p = (q) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * (lat.length - 1)))] : 0;

  const finishedAt = new Date().toISOString();

  const summary = {
    ok: fail === 0,
    apiBase,
    concurrency,
    requests,
    startedAt,
    finishedAt,
    counts: { ok, fail },
    latencyMs: {
      min: lat[0] ?? 0,
      p50: p(0.50),
      p90: p(0.90),
      p99: p(0.99),
      max: lat[lat.length - 1] ?? 0,
    },
    routes,
  };

  if (!existsSync(dirname(outPath))) {
    await mkdir(dirname(outPath), { recursive: true });
  }
  await writeFile(outPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.log(JSON.stringify(summary));
}

main().catch((e) => {
  console.error(String(e?.stack || e?.message || e));
  process.exit(1);
});
