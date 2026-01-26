// ASCII only
// services/api-gateway/src/admin/admin-jobs.ts

import { runRegwatcherJob } from "./regwatcher-runner.js";
import { runDemoStressJob, type DemoStressParams } from "./demo-stress.js";

/**
 * Local structural type. This only needs to structurally match the real JobContext
 * used by your admin runner implementation.
 */
type JobContextLike = {
  job: { id: string; type: string; params?: Record<string, unknown> };
  deadlineMs: number;
  log: (msg: string, data?: Record<string, unknown>) => void;
  logJson: (name: string, obj: unknown) => void;
  writeArtifactJson: (name: string, obj: unknown) => Promise<string | void>;
};

export type AdminJobType = "regwatcher:once" | "demo-stress";

export type AdminJobRequest =
  | { type: "regwatcher:once"; params?: Record<string, unknown> }
  | { type: "demo-stress"; params: DemoStressParams };

function makeCtx(type: AdminJobType, params?: Record<string, unknown>): JobContextLike {
  const id =
    "job_" +
    Math.random().toString(16).slice(2) +
    "_" +
    Date.now().toString(16);

  const deadlineMs = Number(process.env.ADMIN_RUNNER_TIMEOUT_MS ?? "120000");

  return {
    job: { id, type, params },
    deadlineMs,
    log: (msg, data) => {
      if (data) {
        // eslint-disable-next-line no-console
        console.log("[admin-job]", type, msg, JSON.stringify(data));
      } else {
        // eslint-disable-next-line no-console
        console.log("[admin-job]", type, msg);
      }
    },
    logJson: (name, obj) => {
      // eslint-disable-next-line no-console
      console.log("[admin-job-json]", type, name, JSON.stringify(obj));
    },
    writeArtifactJson: async (_name, _obj) => {
      // In your real runner this writes artifacts. Here we keep it no-op but type-correct.
      return;
    },
  };
}

export async function runAdminJob(req: AdminJobRequest) {
  if (req.type === "regwatcher:once") {
    // IMPORTANT: repo implementation expects ONLY (ctx)
    const ctx = makeCtx("regwatcher:once", req.params ?? {});
    return runRegwatcherJob(ctx as any);
  }

  const ctx = makeCtx("demo-stress");
  return runDemoStressJob(ctx as any, req.params);
}
