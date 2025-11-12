import { prisma } from "@apgms/shared/db.js";

const RETENTION_MONTHS = 24;

export interface MonitoringRetentionOptions {
  now?: Date;
  logger?: {
    info?: (payload: Record<string, unknown>, message: string) => void;
    warn?: (payload: Record<string, unknown>, message: string) => void;
  };
}

export interface MonitoringRetentionResult {
  deleted: number;
  cutoff: Date;
}

export async function runMonitoringSnapshotRetentionSweep(
  options: MonitoringRetentionOptions = {},
): Promise<MonitoringRetentionResult> {
  const now = options.now ?? new Date();
  const cutoff = computeCutoff(now, RETENTION_MONTHS);

  const result = await prisma.monitoringSnapshot.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  });

  if (options.logger?.info) {
    options.logger.info(
      {
        cutoff: cutoff.toISOString(),
        deleted: result.count,
      },
      "monitoring_snapshot_retention_sweep",
    );
  }

  return { deleted: result.count, cutoff };
}

function computeCutoff(reference: Date, months: number): Date {
  const cutoff = new Date(reference.getTime());
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}
