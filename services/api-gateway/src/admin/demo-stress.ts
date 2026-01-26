// services/api-gateway/src/admin/demo-stress.ts
export type DemoStressParams = {
  durationSeconds?: number;
  concurrency?: number;
  paths?: string[];
};

type JobContext = {
  log: (line: string) => Promise<void>;
  logJson: (obj: unknown) => Promise<void>;
  writeArtifactJson: (filename: string, obj: unknown) => Promise<string>;
  deadlineMs: number;
};

type LatencyStats = {
  count: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function computeLatencyStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const minMs = count ? sorted[0] : 0;
  const maxMs = count ? sorted[count - 1] : 0;
  const avgMs = count ? Math.round(sorted.reduce((a, b) => a + b, 0) / count) : 0;

  function pct(p: number): number {
    if (!count) return 0;
    const idx = Math.min(count - 1, Math.max(0, Math.floor((p / 100) * (count - 1))));
    return sorted[idx] ?? 0;
  }

  return {
    count,
    minMs,
    maxMs,
    avgMs,
    p50Ms: pct(50),
    p90Ms: pct(90),
    p99Ms: pct(99),
  };
}

export async function runDemoStressJob(ctx: JobContext, params: DemoStressParams): Promise<Record<string, unknown>> {
  const baseUrl = String(process.env.ADMIN_STRESS_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  const durationSeconds = clampInt(params?.durationSeconds, 5, 300, 20);
  const concurrency = clampInt(params?.concurrency, 1, 100, 10);

  const defaultPaths = ["/version", "/metrics"];
  const pathsRaw = Array.isArray(params?.paths) && params!.paths!.length > 0 ? params!.paths! : defaultPaths;
  const paths = pathsRaw.map((p) => (String(p).startsWith("/") ? String(p) : `/${p}`)).slice(0, 20);

  const startedAt = new Date().toISOString();
  const endAtMs = Date.now() + durationSeconds * 1000;

  await ctx.logJson({
    demo_stress_start: {
      baseUrl,
      durationSeconds,
      concurrency,
      paths,
    },
  });

  let total = 0;
  let ok = 0;
  let failed = 0;
  const latencies: number[] = [];

  const controller = new AbortController();

  async function oneWorker(workerId: number): Promise<void> {
    let i = 0;
    while (Date.now() < endAtMs) {
      const path = paths[i % paths.length];
      i += 1;

      const url = `${baseUrl}${path}`;
      const t0 = Date.now();

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "accept": "application/json, text/plain",
          },
          signal: controller.signal,
        });

        const dt = Date.now() - t0;
        latencies.push(dt);
        total += 1;

        if (res.ok) {
          ok += 1;
        } else {
          failed += 1;
          await ctx.log(`demo_stress_http_fail worker=${workerId} url=${url} status=${res.status}`);
        }
      } catch (e) {
        const dt = Date.now() - t0;
        latencies.push(dt);
        total += 1;
        failed += 1;
        await ctx.log(`demo_stress_error worker=${workerId} url=${url} err=${String((e as any)?.message ?? e)}`);
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(oneWorker(w));
  }

  await Promise.all(workers);

  controller.abort();

  const finishedAt = new Date().toISOString();
  const latency = computeLatencyStats(latencies);

  const summary = {
    ok: failed === 0,
    type: "demo-stress",
    startedAt,
    finishedAt,
    durationSeconds,
    concurrency,
    paths,
    totals: {
      total,
      ok,
      failed,
    },
    latency,
  };

  await ctx.writeArtifactJson("demo-stress.summary.json", summary);
  await ctx.logJson({ demo_stress_done: summary });

  if (failed > 0) {
    throw new Error("demo_stress_failed");
  }

  return summary;
}
