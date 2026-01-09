#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "========================================"
echo "Applying API Gateway CORS + Risk fixes"
echo "========================================"

echo "▶ Applying CORS fix to app.ts"

git apply --3way <<'EOF'
diff --git a/services/api-gateway/src/app.ts b/services/api-gateway/src/app.ts
index 6cf26449e..f1f83682b 100644
--- a/services/api-gateway/src/app.ts
+++ b/services/api-gateway/src/app.ts
@@ -1,4 +1,5 @@
 import Fastify from "fastify";
+import cors from "@fastify/cors";
 import { prisma } from "./db.js";
 import { adminServiceModePlugin } from "./routes/admin-service-mode.js";
 import registerRiskSummaryRoutes from "./routes/risk-summary.js";
@@ -45,6 +46,27 @@ export function buildFastifyApp(options: BuildFastifyAppOptions = {}) {
 
   const app = Fastify({ pluginTimeout: 60000, logger });
 
+  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
+    .split(",")
+    .map(o => o.trim())
+    .filter(Boolean);
+
+  app.register(cors, {
+    origin: allowedOrigins.length ? allowedOrigins : true,
+    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
+    allowedHeaders: [
+      "content-type",
+      "authorization",
+      "x-org-id",
+      "x-prototype-admin",
+      "x-admin",
+      "x-role",
+    ],
+    credentials: true,
+  });
+
   app.get("/health", async () => ({ ok: true }));
   app.get("/ready", async () => ({ ok: true }));
EOF

echo "✅ CORS fix applied"

echo "▶ Rewriting risk-summary route deterministically"

cat > services/api-gateway/src/routes/risk-summary.ts <<'EOF'
import type { FastifyInstance } from "fastify";
import { riskBandGauge } from "../observability/metrics.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function gaugeForRisk(band: RiskBand): number {
  switch (band) {
    case "LOW": return 1;
    case "MEDIUM": return 2;
    case "HIGH": return 3;
    default: return 1;
  }
}

async function handler(req: any, reply: any) {
  const orgId = req.headers?.["x-org-id"];
  if (!orgId) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const period = req.query?.period ?? "current";
  const riskBand: RiskBand = req.query?.riskBand ?? "LOW";

  riskBandGauge.set({ orgId, period }, gaugeForRisk(riskBand));

  return reply.send({
    orgId,
    period,
    risk: { riskBand },
  });
}

export default function registerRiskSummaryRoutes(app: FastifyInstance) {
  app.get("/monitor/risk/summary", handler);
}
EOF

echo "✅ Risk summary route fixed"

echo "========================================"
echo "All fixes applied successfully"
echo "========================================"
