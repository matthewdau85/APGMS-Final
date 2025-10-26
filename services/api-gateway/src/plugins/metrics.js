import { Counter, Histogram, collectDefaultMetrics, register, } from "prom-client";
// Collect Node process metrics (CPU, mem, event loop lag, etc)
collectDefaultMetrics();
/**
 * Total request volume, by method/route/status.
 * Lets you do: rate(http_requests_total{status="500"}[5m])
 */
const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of API gateway requests",
    labelNames: ["method", "route", "status"],
});
/**
 * Request latency histogram in seconds, by method/route/status.
 * Lets you do p95(api latency by route).
 */
const httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "Distribution of API gateway response times in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5], // tune if you want finer low-lat buckets
});
/**
 * Generic security/audit events.
 * We'll call this for things like "readiness.fail", "admin.org.delete", etc.
 */
const securityEventsTotal = new Counter({
    name: "security_events_total",
    help: "Count of security or audit events emitted by the gateway",
    labelNames: ["event"],
});
/**
 * Explicit auth failures (unauthorized / forbidden).
 * Why separate from securityEventsTotal?
 * Because SOC/oncall wants to alert specifically on spikes in auth failures.
 */
const authFailuresTotal = new Counter({
    name: "auth_failures_total",
    help: "Count of authentication/authorization failures, labelled by org if known",
    labelNames: ["orgId"],
});
/**
 * Blocked browser origins.
 * If this spikes, either an attacker is hammering you from weird origins
 * or you forgot to add a legit new frontend origin to the allowlist.
 */
const corsRejectTotal = new Counter({
    name: "cors_reject_total",
    help: "Count of rejected CORS requests by origin",
    labelNames: ["origin"],
});
const metricsPlugin = (app, _opts, done) => {
    /**
     * Per-response hook:
     *  - increment http_requests_total
     *  - observe latency into http_request_duration_seconds
     */
    app.addHook("onResponse", (request, reply, doneHook) => {
        const scopedRequest = request;
        // Try to get a stable "route" dimension ("/bank-lines", "/ready", etc.)
        const route = scopedRequest.routerPath ??
            scopedRequest.routeOptions?.url ??
            request.url ??
            "unknown";
        const labels = {
            method: request.method,
            route,
            status: reply.statusCode.toString(),
        };
        httpRequestsTotal.inc(labels);
        // Fastify reply has getResponseTime() when the latency tracking decorator is on.
        // If it's missing, we just fall back to 0 to avoid NaN.
        const getResponseTime = reply.getResponseTime;
        const responseTimeSeconds = typeof getResponseTime === "function"
            ? getResponseTime() / 1000
            : 0;
        if (responseTimeSeconds >= 0) {
            httpRequestDurationSeconds.observe(labels, responseTimeSeconds);
        }
        doneHook();
    });
    /**
     * /metrics endpoint: Prometheus will scrape this.
     */
    app.get("/metrics", async (_req, reply) => {
        reply.header("Content-Type", register.contentType);
        return reply.send(await register.metrics());
    });
    /**
     * Expose helpers on app.metrics so the rest of the code
     * (auth checks, CORS guard, readiness checks, audit logging)
     * can emit structured events.
     */
    app.decorate("metrics", {
        /**
         * recordSecurityEvent("readiness.fail")
         * recordSecurityEvent("admin.org.delete")
         * recordSecurityEvent("anomaly.auth")
         */
        recordSecurityEvent: (event) => {
            securityEventsTotal.inc({ event });
        },
        /**
         * incAuthFailure(orgId)
         *
         * Call this when you send a 401/403 or block a principal.
         * If you don't know org yet, pass "unknown".
         */
        incAuthFailure: (orgId) => {
            authFailuresTotal.inc({ orgId });
        },
        /**
         * incCorsReject(origin)
         *
         * Call this when you reject an Origin in the CORS plugin.
         */
        incCorsReject: (origin) => {
            corsRejectTotal.inc({ origin: origin ?? "unknown" });
        },
    });
    done();
};
export default metricsPlugin;
