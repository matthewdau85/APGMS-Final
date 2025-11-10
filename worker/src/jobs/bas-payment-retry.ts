import { prisma } from "@apgms/shared/db.js";

import {
  basPaymentRetryBacklog,
  basOfflineSubmissionBacklog,
} from "../observability/metrics.js";

const MAX_ATTEMPTS = 5;

export interface PaymentRetryOptions {
  now?: Date;
  batchSize?: number;
  paymentExecutor?: (input: {
    id: string;
    basCycleId: string;
    orgId: string;
    offlineFallback: boolean;
  }) => Promise<void>;
  onFailure?: (input: { id: string; basCycleId: string; orgId: string; error: Error }) => Promise<void>;
}

async function defaultExecutor(input: {
  id: string;
  basCycleId: string;
  orgId: string;
  offlineFallback: boolean;
}): Promise<void> {
  if (input.offlineFallback) {
    // Offline submissions are acknowledged immediately; reconciliation will
    // settle the funds once the banking window reopens.
    return;
  }
  // In lieu of a real banking adapter we simply simulate success.
  return;
}

async function defaultFailureHandler(input: {
  id: string;
  basCycleId: string;
  orgId: string;
  error: Error;
}): Promise<void> {
  console.error("bas_payment_attempt_failed", input);
}

export async function processBasPaymentRetryQueue(
  options: PaymentRetryOptions = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 25;
  const executor = options.paymentExecutor ?? defaultExecutor;
  const failureHandler = options.onFailure ?? defaultFailureHandler;

  const pending = await prisma.basPaymentAttempt.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  basPaymentRetryBacklog.set(pending.length);

  for (const attempt of pending) {
    try {
      await executor({
        id: attempt.id,
        basCycleId: attempt.basCycleId,
        orgId: attempt.orgId,
        offlineFallback: attempt.offlineFallback,
      });

      await prisma.basPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUCCEEDED",
          attemptCount: attempt.attemptCount + 1,
          failureReason: null,
          nextRunAt: null,
        },
      });
    } catch (error) {
      const attemptCount = attempt.attemptCount + 1;
      const exhausted = attemptCount >= MAX_ATTEMPTS;
      const nextRunAt = exhausted
        ? null
        : new Date(now.getTime() + Math.pow(2, attemptCount) * 60 * 1000);

      await prisma.basPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: exhausted ? "FAILED" : "RETRYING",
          attemptCount,
          failureReason: (error as Error).message,
          nextRunAt,
        },
      });

      if (exhausted) {
        await failureHandler({
          id: attempt.id,
          basCycleId: attempt.basCycleId,
          orgId: attempt.orgId,
          error: error as Error,
        });
      }
    }
  }

  const offlineBacklog = await prisma.basPaymentAttempt.count({
    where: { status: "PENDING", offlineFallback: true },
  });
  basOfflineSubmissionBacklog.set(offlineBacklog);
}
