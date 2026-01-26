// ASCII only
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type AdminJobStatus = "queued" | "running" | "succeeded" | "failed";

export type AdminJobRun = {
  id: string;
  type: string;
  status: AdminJobStatus;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  params: Record<string, unknown> | null;
  resultSummary: Record<string, unknown> | null;
  exitCode?: number;
  logPath: string;
  lastLogLines: string[];
};

export type AdminJobLimits = {
  maxConcurrency: number;
  maxDurationMs: number;
  maxLogBytes: number;
  lastLines: number;
  logDir: string;
  redact: string[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function readEnvInt(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? "").trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function redactLine(line: string, tokens: string[]): string {
  let out = line;
  for (const t of tokens) {
    if (!t) continue;
    out = out.split(t).join("[REDACTED]");
  }
  // crude bearer redaction
  out = out.replace(/Authorization:\s*Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, "Authorization: Bearer [REDACTED]");
  return out;
}

function tailLines(all: string, maxLines: number): string[] {
  const lines = all.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= maxLines) return lines;
  return lines.slice(lines.length - maxLines);
}

export class AdminJobService {
  private runs: AdminJobRun[] = [];
  private queue: Array<() => Promise<void>> = [];
  private active = 0;
  private limits: AdminJobLimits;

  constructor(limits: Partial<AdminJobLimits> = {}) {
    const logDir = limits.logDir ?? String(process.env.ADMIN_RUN_LOG_DIR ?? ".data/admin-runs").trim();
    const maxConcurrency = clampInt(readEnvInt("ADMIN_MAX_CONCURRENCY", limits.maxConcurrency ?? 1), 1, 8);
    const maxDurationMs = clampInt(readEnvInt("ADMIN_MAX_DURATION_MS", limits.maxDurationMs ?? 300_000), 10_000, 3_600_000);
    const maxLogBytes = clampInt(readEnvInt("ADMIN_MAX_LOG_BYTES", limits.maxLogBytes ?? 1_000_000), 50_000, 10_000_000);
    const lastLines = clampInt(readEnvInt("ADMIN_LAST_LOG_LINES", limits.lastLines ?? 200), 20, 2000);

    this.limits = {
      maxConcurrency,
      maxDurationMs,
      maxLogBytes,
      lastLines,
      logDir,
      redact: Array.isArray(limits.redact) ? limits.redact : [],
    };
  }

  public getRecent(limit = 20): AdminJobRun[] {
    const n = clampInt(limit, 1, 100);
    return this.runs.slice(-n).reverse();
  }

  public getById(id: string): AdminJobRun | null {
    return this.runs.find((r) => r.id === id) ?? null;
  }

  public getLastOfType(type: string): AdminJobRun | null {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      if (this.runs[i].type === type) return this.runs[i];
    }
    return null;
  }

  public async enqueue(opts: {
    type: string;
    params: Record<string, unknown> | null;
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    extraRedactions?: string[];
    resultJsonPathHint?: string;
  }): Promise<AdminJobRun> {
    const id = randomUUID();
    const logPath = join(this.limits.logDir, `${id}.log`);
    await mkdir(this.limits.logDir, { recursive: true });

    const run: AdminJobRun = {
      id,
      type: opts.type,
      status: "queued",
      queuedAt: nowIso(),
      params: opts.params,
      resultSummary: null,
      logPath,
      lastLogLines: [],
    };

    this.runs.push(run);

    const task = async () => {
      run.status = "running";
      run.startedAt = nowIso();

      const redactTokens = [
        ...this.limits.redact,
        ...(opts.extraRedactions ?? []),
      ].filter(Boolean);

      const child = spawn(opts.command, opts.args, {
        cwd: opts.cwd,
        env: { ...process.env, ...(opts.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let out = "";
      let killedByTimeout = false;

      const timer = setTimeout(() => {
        killedByTimeout = true;
        try { child.kill("SIGKILL"); } catch {}
      }, this.limits.maxDurationMs);

      const onData = (buf: Buffer) => {
        const s = buf.toString("utf8");
        out += s;
        if (out.length > this.limits.maxLogBytes) {
          out = out.slice(out.length - this.limits.maxLogBytes);
        }
      };

      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);

      const exitCode: number = await new Promise((resolve) => {
        child.on("close", (code) => resolve(typeof code === "number" ? code : 1));
      });

      clearTimeout(timer);

      const redacted = out
        .split("\n")
        .map((l) => redactLine(l, redactTokens))
        .join("\n");

      await writeFile(logPath, redacted, { encoding: "utf8" });

      run.exitCode = exitCode;
      run.finishedAt = nowIso();

      if (killedByTimeout) {
        run.status = "failed";
        run.resultSummary = { ok: false, reason: "timeout", maxDurationMs: this.limits.maxDurationMs };
      } else if (exitCode === 0) {
        run.status = "succeeded";
        run.resultSummary = { ok: true };
      } else {
        run.status = "failed";
        run.resultSummary = { ok: false, exitCode };
      }

      run.lastLogLines = tailLines(redacted, this.limits.lastLines);

      // Optional result JSON summary extraction (best-effort)
      if (opts.resultJsonPathHint && existsSync(opts.resultJsonPathHint)) {
        try {
          const txt = await readFile(opts.resultJsonPathHint, "utf8");
          const parsed = JSON.parse(txt);
          run.resultSummary = {
            ...(run.resultSummary ?? {}),
            result: parsed,
          };
        } catch {
          // ignore
        }
      }
    };

    this.queue.push(task);
    this.pump();
    return run;
  }

  private pump() {
    while (this.active < this.limits.maxConcurrency && this.queue.length > 0) {
      const t = this.queue.shift()!;
      this.active++;
      void t()
        .catch(() => void 0)
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}
