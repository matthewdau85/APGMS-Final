import { createApp } from "./app.js";

export async function main() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(`api-gateway listening on http://${host}:${port}`);
}

// Only run the server when this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Fatal error starting api-gateway server", err);
    process.exit(1);
  });
}
