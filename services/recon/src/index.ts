import { config } from "./config.js";
import { createGrpcServer } from "./grpc.js";
import { createHttpServer } from "./http.js";
import { ReconciliationService } from "./service.js";

async function bootstrap(): Promise<void> {
  const service = new ReconciliationService();
  const http = createHttpServer(service);

  try {
    await http.listen({ port: config.httpPort, host: "0.0.0.0" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start HTTP server", error);
    await service.close();
    process.exitCode = 1;
    return;
  }

  let grpcServer: Awaited<ReturnType<typeof createGrpcServer>> | null = null;
  try {
    grpcServer = await createGrpcServer(service, config.grpcPort);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start gRPC server", error);
    await http.close();
    await service.close();
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      event: "recon_service_started",
      httpPort: config.httpPort,
      grpcAddress: grpcServer.address,
    }),
  );

  const shutdown = async () => {
    try {
      await http.close();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to close HTTP server", error);
    }

    if (grpcServer) {
      await new Promise<void>((resolve) => {
        grpcServer?.server.tryShutdown((err) => {
          if (err) {
            grpcServer?.server.forceShutdown();
          }
          resolve();
        });
      });
    }

    await service.close();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

void bootstrap();
