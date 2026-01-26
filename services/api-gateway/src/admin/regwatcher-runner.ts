// services/api-gateway/src/admin/regwatcher-runner.ts
import { spawn } from "node:child_process";

type JobContext = {
  job: {
    id: string;
  };
  log: (line: string) => Promise<void>;
  logJson: (obj: unknown) => Promise<void>;
  writeArtifactJson: (filename: string, obj: unknown) => Promise<string>;
  deadlineMs: number;
};

function parseCmd(cmdLine: string): { cmd: string; args: string[] } {
  const raw = (cmdLine || "").trim();
  if (!raw) return { cmd: "", args: [] };
  const parts = raw.split(/\s+/g).filter(Boolean);
  return { cmd: parts[0] || "", args: parts.slice(1) };
}

export async function runRegwatcherJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const defaultCmd = "pnpm -C packages/regwatcher run regwatcher";
  const cmdLine = String(process.env.REGWATCHER_CMD ?? defaultCmd).trim();
  const { cmd, args } = parseCmd(cmdLine);

  if (!cmd) {
    throw new Error("regwatcher_cmd_missing");
  }

  await ctx.log(`regwatcher_start cmdLine=${cmdLine}`);

  const startedAt = new Date().toISOString();

  const child = spawn(cmd, args, {
    env: {
      ...process.env,
      // Do not inject secrets into child process beyond what's already in env
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const chunks: string[] = [];

  child.stdout.on("data", (d) => {
    const s = String(d);
    chunks.push(s);
    void ctx.log(s.trimEnd());
  });

  child.stderr.on("data", (d) => {
    const s = String(d);
    chunks.push(s);
    void ctx.log(s.trimEnd());
  });

  const exitCode: number = await new Promise((resolve) => {
    child.on("close", (code) => resolve(typeof code === "number" ? code : 1));
    child.on("error", () => resolve(1));
  });

  const finishedAt = new Date().toISOString();
  const status = exitCode === 0 ? "success" : "failed";

  const summary = {
    ok: exitCode === 0,
    type: "regwatcher",
    startedAt,
    finishedAt,
    status,
    exitCode,
    cmdLine,
  };

  await ctx.logJson({ regwatcher_summary: summary });

  // Write a small artifact snapshot of the last output (bounded)
  const tail = chunks.join("").slice(-20_000);
  await ctx.writeArtifactJson("regwatcher.tail.json", { tail });

  if (exitCode !== 0) {
    throw new Error("regwatcher_failed");
  }

  return summary;
}
