import { installPrismaMetrics } from "./prisma-metrics.js";

export function installDbMetrics(prisma: any): void {
  installPrismaMetrics(prisma);
}
