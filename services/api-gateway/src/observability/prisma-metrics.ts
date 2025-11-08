import type { PrismaClient } from "@prisma/client";

import { metrics } from "./metrics.js";

type MiddlewareParams = {
  model?: string;
  action?: string;
  type?: string;
  [key: string]: unknown;
};

type MiddlewareNext = (params: MiddlewareParams) => Promise<unknown>;

type MiddlewareFn = (params: MiddlewareParams, next: MiddlewareNext) => Promise<unknown>;

const attached = new WeakSet<object>();

export function attachPrismaMetrics(client: PrismaClient): void {
  if (attached.has(client)) {
    return;
  }

  const middleware: MiddlewareFn = async (params, next) => {
    const model = params.model ?? "raw";
    const operation = params.action ?? params.type ?? "unknown";

    const stop = metrics.dbQueryDuration.startTimer({
      model,
      operation,
    });

    try {
      const result = await next(params);
      metrics.dbQueryTotal
        .labels(model, operation, "success")
        .inc();
      stop();
      return result;
    } catch (error) {
      metrics.dbQueryTotal
        .labels(model, operation, "error")
        .inc();
      stop();
      throw error;
    }
  };

  const target = client as unknown as { $use?: (mw: MiddlewareFn) => void };
  if (typeof target.$use !== "function") {
    attached.add(client);
    return;
  }

  target.$use(middleware);

  attached.add(client);
}
