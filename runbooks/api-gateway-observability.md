# API Gateway Observability & Operations

## Runtime endpoints

| Endpoint   | Description |
| ---------- | ----------- |
| `GET /health`  | Liveness probe that reports the service name and indicates that the Fastify instance is running. |
| `GET /ready`   | Readiness probe that checks required dependencies. The response body is `{ ready: boolean, dependencies: { database: boolean, queue: boolean } }`. If any dependency fails, the route returns `503`. |
| `GET /metrics` | Exposes Prometheus-formatted metrics including default process stats, HTTP request duration histograms, and Prisma database timings. |

## Metrics

Metrics are collected through a lightweight Prometheus client that is registered when the server boots. Default process statistics are exported with the `apgms_` prefix. Custom histograms provide insight into:

- `apgms_http_request_duration_seconds{method,route,status_code}` for Fastify handler timings.
- `apgms_db_query_duration_seconds{model,action}` for Prisma query durations.

## Shutdown behaviour

The Fastify bootstrap (`src/index.ts`) listens for `SIGTERM` and `SIGINT`. When either signal is received the server:

1. Logs the signal receipt for traceability.
2. Awaits `app.close()` to drain connections and run registered `onClose` hooks (including disconnecting Prisma and closing the queue client when applicable).
3. Exits with code `0` on success or `1` if shutdown throws.

Kubernetes or process supervisors should rely on the readiness endpoint before terminating pods to ensure dependent workloads continue to function.
