import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register as promRegister,
} from 'prom-client';

// ---- Registry & default process metrics ----
collectDefaultMetrics({ register: promRegister });

// ---- HTTP metrics ----
const httpRequestTotal = new Counter({
  name: 'apgms_http_requests_total',
  help: 'Total HTTP requests by method, route, and status code',
  labelNames: ['method', 'route', 'status'] as const,
});

const httpRequestDuration = new Histogram({
  name: 'apgms_http_request_duration_seconds',
  help: 'HTTP request duration histogram',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

// ---- DB metrics (use from your Prisma middleware) ----
const dbQueryDuration = new Histogram({
  name: 'apgms_db_query_duration_seconds',
  help: 'Prisma query duration by model and operation',
  labelNames: ['model', 'operation'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

const dbQueryTotal = new Counter({
  name: 'apgms_db_queries_total',
  help: 'Total Prisma queries by model, operation, and status',
  labelNames: ['model', 'operation', 'status'] as const,
});

// ---- Background job metrics ----
const jobDuration = new Histogram({
  name: 'apgms_job_duration_seconds',
  help: 'Background job duration histogram',
  labelNames: ['job'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
});

const integrationEventDuration = new Histogram({
  name: 'apgms_integration_event_duration_seconds',
  help: 'Time to process payroll / POS integration events',
  labelNames: ['tax_type', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
});

const integrationEventsTotal = new Counter({
  name: 'apgms_integration_events_total',
  help: 'Total payroll / POS integration events processed',
  labelNames: ['tax_type', 'status'] as const,
});

const integrationDiscrepanciesTotal = new Counter({
  name: 'apgms_integration_discrepancies_total',
  help: 'Discrepancy alerts raised when amounts mismatch expected values',
  labelNames: ['tax_type', 'severity'] as const,
});

const obligationsTotal = new Gauge({
  name: 'apgms_integration_pending_obligation_amount',
  help: 'Current pending obligations per tax type',
  labelNames: ['tax_type'] as const,
});

const integrationAnomalyScore = new Gauge({
  name: 'apgms_integration_anomaly_score',
  help: 'Heuristic anomaly score ([-1,1]) for integration feeds',
  labelNames: ['tax_type', 'severity'] as const,
});

const basLodgmentsTotal = new Counter({
  name: 'apgms_bas_lodgments_total',
  help: 'Total BAS lodgment attempts',
  labelNames: ['status'] as const,
});

const transferInstructionTotal = new Counter({
  name: 'apgms_transfer_instructions_total',
  help: 'Transfer instructions generated for BAS lodgments',
  labelNames: ['tax_type', 'status'] as const,
});

const transferExecutionTotal = new Counter({
  name: 'apgms_transfer_execution_total',
  help: 'Execution attempts for transfer instructions',
  labelNames: ['status'] as const,
});

const paymentPlanRequestsTotal = new Counter({
  name: 'apgms_payment_plan_requests_total',
  help: 'Payment plan requests created after failed BAS lodgments',
  labelNames: ['status'] as const,
});

const atoReportsTotal = new Counter({
  name: 'apgms_ato_reports_total',
  help: 'ATO compliance reports submitted',
  labelNames: ['status'] as const,
});

const riskEventsTotal = new Counter({
  name: 'apgms_risk_events_total',
  help: 'Risk events recorded',
  labelNames: ['severity'] as const,
});

const basLodgmentsTotal = new Counter({
  name: 'apgms_bas_lodgments_total',
  help: 'Total BAS lodgment attempts',
  labelNames: ['status'] as const,
});

// ---- Public API for DB/jobs instrumentation ----
export const metrics = {
  httpRequestTotal,
  httpRequestDuration,
  dbQueryDuration,
  dbQueryTotal,
  jobDuration,
  integrationEventDuration,
  integrationEventsTotal,
  integrationDiscrepanciesTotal,
  obligationsTotal,
  integrationAnomalyScore,
  basLodgmentsTotal,
  transferInstructionTotal,
  transferExecutionTotal,
  paymentPlanRequestsTotal,
  atoReportsTotal,
  riskEventsTotal,

  async observeJob<T>(job: string, fn: () => Promise<T>): Promise<T> {
    const stop = jobDuration.startTimer({ job });
    try {
      const result = await fn();
      stop();
      return result;
    } catch (err) {
      stop();
      throw err;
    }
  },
};

export { promRegister };

// ---- /metrics route (Prometheus text format) ----
export function registerMetricsRoute(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', promRegister.contentType);
    return promRegister.metrics();
  });
}

// ---- Optional Fastify hooks to auto-collect HTTP metrics ----
type ReqWithStart = FastifyRequest & { _apgmsStartNs?: bigint };

export function installHttpMetrics(app: FastifyInstance) {
  app.addHook('onRequest', (req: ReqWithStart, _reply, done) => {
    // monotonic clock for duration
    req._apgmsStartNs = process.hrtime.bigint();
    done();
  });

  app.addHook('onResponse', (req: ReqWithStart, reply: FastifyReply, done) => {
    try {
      const endNs = process.hrtime.bigint();
      const startNs = req._apgmsStartNs ?? endNs;
      const durSeconds = Number(endNs - startNs) / 1e9;

      const method = (req.method || 'GET').toUpperCase();
      const status = String(reply.statusCode || 0);

      // Try to get a stable route template; fall back to raw URL
      // Fastify v4: request.routeOptions.url is usually present for registered routes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const route =
        (req as any).routeOptions?.url ||
        // older plugin contexts sometimes expose routerPath
        (req as any).routerPath ||
        req.url ||
        'unknown';

      httpRequestTotal.inc({ method, route, status }, 1);
      httpRequestDuration.observe({ method, route, status }, durSeconds);
    } catch {
      // never block responses on metrics errors
    }
    done();
  });
}
