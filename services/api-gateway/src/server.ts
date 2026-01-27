import buildFastifyApp, { buildFastifyApp as buildFastifyAppNamed } from "./app.js";

export async function startServer() {
  // Prefer the named export, but fall back to default to prevent future drift.
  const build = buildFastifyAppNamed ?? buildFastifyApp;

  const app = await build();

  const gitSha = process.env.GIT_SHA ?? "dev";
  const buildTs = process.env.BUILD_TS ?? new Date().toISOString();
  const nodeVersion = process.version;
  const env = process.env.NODE_ENV ?? "development";

  app.log.info({ gitSha, buildTs, node: nodeVersion, env }, "service identity");

  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? "3000");

  await app.listen({ host, port });
  return app;
}
