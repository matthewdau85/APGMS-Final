import { buildServer } from "./app.js";

(async () => {
  const app = await buildServer();
  await app.listen({
    port: 3000,
    host: "0.0.0.0",
  });
  app.log.info("api-gateway listening on 3000");
})();
