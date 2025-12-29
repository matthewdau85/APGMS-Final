import { dbQueryDurationSeconds } from "./metrics.js";

export function installPrismaMetrics(prisma: any): void {
  if (!prisma || typeof prisma.$on !== "function") return;

  // Prisma emits query events with duration in ms
  try {
    prisma.$on("query", (e: any) => {
      const durationMs = Number(e?.duration ?? 0);
      const durationSec = durationMs / 1000;

      const model = String(e?.model ?? "unknown");
      const action = String(e?.action ?? "query");

      dbQueryDurationSeconds.observe({ model, action, status: "ok" }, durationSec);
    });
  } catch {
    // do not crash startup if Prisma event API differs
  }
}
