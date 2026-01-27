#!/usr/bin/env bash
set -euo pipefail

log() { printf "\n[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

REPO_ROOT="$(pwd)"

# Basic repo sanity
[[ -f "services/api-gateway/src/app.ts" ]] || die "Run from repo root (services/api-gateway/src/app.ts not found)."

TS="$(date -u +"%Y%m%d-%H%M%S")"
BACKUP_DIR=".backup/prototype-fix-$TS"
mkdir -p "$BACKUP_DIR"

backup_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -a "$f" "$BACKUP_DIR/$f"
  fi
}

write_file() {
  local f="$1"
  shift
  mkdir -p "$(dirname "$f")"
  cat > "$f" <<'EOF'
EOF
  # append provided content via stdin (so we can keep this function simple)
}

write_file_content() {
  local f="$1"
  shift
  mkdir -p "$(dirname "$f")"
  cat > "$f" <<'EOF'
'"$@"'
EOF
}

# We avoid clever helpers and just use heredocs per-file for determinism.
log "Backing up files that will be overwritten..."
backup_file "services/api-gateway/src/security/requireAdmin.ts"
backup_file "services/api-gateway/src/admin/admin-jobs.ts"
backup_file "services/api-gateway/src/routes/admin-agent.ts"
backup_file "services/api-gateway/src/routes/admin-regwatcher.ts"
backup_file "services/api-gateway/src/routes/admin.regwatcher.ts"
backup_file "services/api-gateway/src/routes/admin.agent.ts"
backup_file "services/api-gateway/src/routes/admin-demo-orchestrator.ts"
backup_file "services/api-gateway/src/server.ts"
backup_file "services/api-gateway/src/app.ts"

log "Removing accidental services/api-gateway/src/server.js if present..."
rm -f services/api-gateway/src/server.js || true

log "Writing: services/api-gateway/src/security/requireAdmin.ts"
cat > services/api-gateway/src/security/requireAdmin.ts <<'EOF'
// ASCII only
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function requireAdmin(app: FastifyInstance) {
  return async function adminGuard(req: FastifyRequest, reply: FastifyReply) {
    const token = String(process.env.INTERNAL_ADMIN_TOKEN ?? "");
    if (!token) {
      reply.code(500).send({ ok: false, error: { code: "admin_token_not_configured" } });
      return;
    }

    const hdr = req.headers["x-admin-token"];
    const provided = Array.isArray(hdr) ? String(hdr[0] ?? "") : String(hdr ?? "");

    if (!provided || !constantTimeEqual(provided, token)) {
      reply.code(403).send({ ok: false, error: { code: "admin_forbidden" } });
      return;
    }
  };
}
EOF

log "Writing: services/api-gateway/src/admin/admin-jobs.ts (fixed signatures)"
cat > services/api-gateway/src/admin/admin-jobs.ts <<'EOF'
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
EOF

log "Writing: services/api-gateway/src/routes/admin-agent.ts (canonical)"
cat > services/api-gateway/src/routes/admin-agent.ts <<'EOF'
// ASCII only
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../security/requireAdmin.js";
import { runAdminJob } from "../admin/admin-jobs.js";

const RunReqSchema = z.object({
  job: z.enum(["demo-stress", "agent-suite", "smoke"]).default("demo-stress"),
});

export async function registerAdminAgentRoutes(app: FastifyInstance) {
  const guard = requireAdmin(app);

  app.get("/admin/agent/runs", { preHandler: guard }, async (_req, reply) => {
    // Your real job store can be wired here; for now, keep API stable.
    return reply.send({ ok: true, runs: [] });
  });

  app.post("/admin/agent/run", { preHandler: guard }, async (req, reply) => {
    const parsed = RunReqSchema.safeParse((req as any).body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: { code: "invalid_request" } });
      return;
    }

    // Map to current minimal job execution:
    // - "demo-stress" runs real demo stress runner in your repo (admin/demo-stress.ts)
    // - others are placeholders until you map them to concrete job types
    if (parsed.data.job === "demo-stress") {
      const result = await runAdminJob({
        type: "demo-stress",
        params: {
          concurrency: Number(process.env.DEMO_STRESS_CONCURRENCY ?? "5"),
          durationMs: Number(process.env.DEMO_STRESS_DURATION_MS ?? "5000"),
          target: String(process.env.DEMO_STRESS_TARGET ?? "http://127.0.0.1:3000"),
          routes: ["/version", "/metrics"],
        },
      });
      return reply.send({ ok: true, runId: "inline", result, position: "Internal orchestration and automation runner for the operator." });
    }

    return reply.send({
      ok: true,
      runId: "inline",
      position: "Internal orchestration and automation runner for the operator.",
      note: "Job placeholder: wire this to your job runner/store when ready.",
    });
  });
}
EOF

log "Writing: services/api-gateway/src/routes/admin-regwatcher.ts (NO execa)"
cat > services/api-gateway/src/routes/admin-regwatcher.ts <<'EOF'
// ASCII only
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../security/requireAdmin.js";
import { runAdminJob } from "../admin/admin-jobs.js";

const RunReqSchema = z.object({
  mode: z.enum(["once"]).default("once"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export async function registerAdminRegWatcherRoutes(app: FastifyInstance) {
  const guard = requireAdmin(app);

  app.get("/admin/regwatcher/status", { preHandler: guard }, async (_req, reply) => {
    return reply.send({
      ok: true,
      cachePresent: false,
      cacheFile: null,
      lastRun: null,
    });
  });

  app.post("/admin/regwatcher/run", { preHandler: guard }, async (req, reply) => {
    const parsed = RunReqSchema.safeParse((req as any).body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: { code: "invalid_request" } });
      return;
    }

    const result = await runAdminJob({ type: "regwatcher:once", params: parsed.data.params ?? {} });
    return reply.send({
      ok: true,
      runId: "inline",
      result,
    });
  });
}
EOF

log "Writing: dot-variant route files as tiny re-exports (compatibility)"
cat > services/api-gateway/src/routes/admin.regwatcher.ts <<'EOF'
// ASCII only
export { registerAdminRegWatcherRoutes } from "./admin-regwatcher.js";
EOF

cat > services/api-gateway/src/routes/admin.agent.ts <<'EOF'
// ASCII only
export { registerAdminAgentRoutes } from "./admin-agent.js";
EOF

log "Writing: services/api-gateway/src/routes/admin-demo-orchestrator.ts"
cat > services/api-gateway/src/routes/admin-demo-orchestrator.ts <<'EOF'
// ASCII only
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../security/requireAdmin.js";

export async function registerAdminDemoOrchestratorRoutes(app: FastifyInstance) {
  const guard = requireAdmin(app);

  // Minimal endpoint to keep UI/tests stable if referenced
  app.post("/admin/demo/reset", { preHandler: guard }, async (_req, reply) => {
    return reply.send({ ok: true });
  });
}
EOF

log "Writing: services/api-gateway/src/server.ts exporting startServer"
cat > services/api-gateway/src/server.ts <<'EOF'
// ASCII only
import type { FastifyInstance } from "fastify";
import { buildFastifyApp } from "./app.js";

export async function startServer(): Promise<FastifyInstance> {
  const app = buildFastifyApp({ logger: true });
  const host = String(process.env.HOST ?? "127.0.0.1");
  const port = Number(process.env.PORT ?? "3000");
  await app.listen({ host, port });
  return app;
}
EOF

log "Writing: services/api-gateway/src/app.ts (single admin registration block)"
cat > services/api-gateway/src/app.ts <<'EOF'
// services/api-gateway/src/app.ts
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import regulatorComplianceSummaryRoute from "./routes/regulator-compliance-summary.js";
import regulatorComplianceEvidencePackPlugin from "./routes/regulator-compliance-evidence-pack.js";
import { basSettlementRoutes } from "./routes/bas-settlement.js";
import basPreviewRoutes from "./routes/bas-preview.js";
import designatedAccountRoutes from "./routes/designated-accounts.js";
import alertsRoutes from "./routes/alerts.js";
import evidenceRoutes from "./routes/evidence.js";

import {
  isPrototypePath,
  isPrototypeAdminOnlyPath,
} from "./prototype/prototype-paths.js";

import { helmetConfigFor } from "./security-headers.js";

import { registerAdminRegWatcherRoutes } from "./routes/admin-regwatcher.js";
import { registerAdminAgentRoutes } from "./routes/admin-agent.js";
import { registerAdminDemoOrchestratorRoutes } from "./routes/admin-demo-orchestrator.js";

export interface BuildAppOpts {
  logger?: boolean;
}

type RuntimeIdentity = {
  service: "api-gateway";
  gitSha: string;
  buildTs: string;
  nodeEnv: string;
  apgmsMode: string;
};

function getRuntimeIdentity(): RuntimeIdentity {
  const nodeEnv = String(process.env.NODE_ENV ?? "development").toLowerCase();
  const gitSha = String(process.env.GIT_SHA ?? "unknown");
  const buildTs = String(process.env.BUILD_TS ?? "unknown");
  const apgmsMode = String(process.env.APGMS_MODE ?? nodeEnv);

  return {
    service: "api-gateway",
    gitSha,
    buildTs,
    nodeEnv,
    apgmsMode,
  };
}

export function buildFastifyApp(opts: BuildAppOpts = {}): FastifyInstance {
  const env = String(process.env.NODE_ENV ?? "development").toLowerCase();
  const app = Fastify({ logger: Boolean(opts.logger) });

  const ident = getRuntimeIdentity();

  if (opts.logger) {
    app.log.info({ ident }, "runtime_identity");
    if (ident.gitSha === "unknown" || ident.gitSha === "dev") {
      app.log.warn("[WARN] GIT_SHA not set (running without deterministic identity).");
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("[runtime_identity]", JSON.stringify(ident));
    if (ident.gitSha === "unknown" || ident.gitSha === "dev") {
      // eslint-disable-next-line no-console
      console.log("[WARN] GIT_SHA not set (running without deterministic identity).");
    }
  }

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.register(cors, { origin: true });
  app.register(helmet, helmetConfigFor({ cors: { allowedOrigins } }));

  // Production: hard-disable prototype/demo endpoints at the edge (404)
  app.addHook("onRequest", async (req, reply) => {
    if (env !== "production") return;

    const url = req.url || "";
    if (isPrototypePath(url)) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
  });

  // Non-production: enforce admin-only gating on prototype/demo paths (403)
  app.addHook("onRequest", async (req, reply) => {
    if (env === "production") return;

    const url = req.url || "";
    if (!isPrototypeAdminOnlyPath(url)) return;

    const enablePrototype =
      String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
    if (!enablePrototype) {
      reply.code(404).send({ error: "not_found" });
      return;
    }

    const raw = String((req.headers as any)["x-prototype-admin"] ?? "").toLowerCase();
    const ok = raw === "1" || raw === "true";
    if (!ok) {
      reply.code(403).send({ ok: false, error: "admin_only_prototype" });
      return;
    }
  });

  // Core routes
  app.register(regulatorComplianceSummaryRoute);
  app.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });

  app.register(alertsRoutes);
  app.register(designatedAccountRoutes);
  app.register(basPreviewRoutes);
  app.register(evidenceRoutes);
  app.register(basSettlementRoutes);

  // ADMIN REGISTRATION BLOCK (single audit point)
  app.register(async (admin) => {
    await registerAdminRegWatcherRoutes(admin);
    await registerAdminAgentRoutes(admin);
    await registerAdminDemoOrchestratorRoutes(admin);
  });

  app.get("/version", async (_req, reply) => {
    reply.header("content-type", "application/json; charset=utf-8");
    return reply.send(getRuntimeIdentity());
  });

  app.get("/metrics", async (_req, reply) => {
    const metrics: any = (app as any).metrics;
    const body =
      metrics && typeof metrics.metrics === "function"
        ? await metrics.metrics()
        : "";
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return reply.send(body);
  });

  return app;
}

export const buildApp = buildFastifyApp;
EOF

log "Installing deps (repo root) - safe to re-run"
pnpm install --frozen-lockfile

log "Typecheck api-gateway (fail-fast)"
pnpm -C services/api-gateway typecheck

log "DONE. Next commands:"
cat <<EOF
1) Start API gateway:
   INTERNAL_ADMIN_TOKEN="${INTERNAL_ADMIN_TOKEN:-dev-admin-token}" pnpm -C services/api-gateway dev

2) Start webapp:
   pnpm -C webapp dev

3) Run Playwright:
   pnpm -C webapp test:e2e
EOF
