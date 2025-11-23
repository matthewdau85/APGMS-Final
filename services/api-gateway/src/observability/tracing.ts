import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PrismaInstrumentation } from "@opentelemetry/instrumentation-prisma";

let sdk: NodeSDK | null = null;

export async function startTracing() {
  if (sdk) return;

  // Prefer env vars:
  //   OTEL_SERVICE_NAME=apgms-api-gateway
  //   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const traceExporter = new OTLPTraceExporter(
    endpoint ? { url: endpoint } : undefined
  );

  sdk = new NodeSDK({
    // rely on env OTEL_SERVICE_NAME instead of programmatic Resource to avoid TS drift
    traceExporter: traceExporter as unknown as any,
    instrumentations: [
      new FastifyInstrumentation({
        requestHook(span) {
          span?.setAttribute("service.name", "apgms-api-gateway");
        },
      }),
      new PrismaInstrumentation(),
    ],
  });

  await sdk.start();
}

export async function stopTracing() {
  if (!sdk) return;
  const s = sdk;
  sdk = null;
  try {
    await s.shutdown();
  } catch {
    // swallow
  }
}
