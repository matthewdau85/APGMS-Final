import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { PrismaInstrumentation } from "@prisma/instrumentation";

let sdk: NodeSDK | null = null;

function parseHeaders(): Record<string, string> | undefined {
  const headerSource =
    process.env.OTEL_EXPORTER_OTLP_HEADERS ??
    process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;
  if (!headerSource) {
    return;
  }

  const headers: Record<string, string> = {};
  for (const entry of headerSource.split(",")) {
    const [key, value] = entry.split("=").map((part) => part?.trim());
    if (key && value) {
      headers[key] = value;
    }
  }
  return headers;
}

export async function initTracing(
  serviceName = "api-gateway",
): Promise<void> {
  if (sdk) {
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    headers: parseHeaders(),
  });

  sdk = new NodeSDK({
    traceExporter: exporter,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME ?? serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.APP_VERSION ?? "0.1.0",
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  await sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("failed to shut down tracing", error);
  });
  sdk = null;
}

