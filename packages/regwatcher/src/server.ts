import Fastify from "fastify";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import { ensureLayout, readRecentChanges, getLastSnapshot, loadManifest } from "./lib/store.js";
import { TARGETS } from "./targets.js";

const PORT = Number(process.env.REGWATCH_PORT ?? "3030");
const HOST = process.env.REGWATCH_HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });
await app.register(fastifyHelmet, { contentSecurityPolicy: false });
await app.register(fastifyCors, { origin: [/^http:\/\/localhost:\d+$/] });

ensureLayout();

app.get("/health", async () => ({ ok: true, ts: new Date().toISOString() }));
app.get("/targets", async () => ({ targets: TARGETS }));
app.get("/changes", async (req) => {
  const limit = Math.max(1, Math.min(200, Number((req.query as any)?.limit ?? 50)));
  return { items: readRecentChanges(limit) };
});
app.get("/last", async (req, rep) => {
  const tid = (req.query as any)?.target;
  if (!tid) return rep.code(400).send({ error: "target required" });
  const meta = getLastSnapshot(String(tid));
  if (!meta) return rep.code(404).send({ error: "no snapshot" });
  return { item: meta };
});
app.get("/manifest", async (req, rep) => {
  const tid = (req.query as any)?.target;
  if (!tid) return rep.code(400).send({ error: "target required" });
  const t = TARGETS.find((x) => x.id === String(tid));
  if (!t) return rep.code(404).send({ error: "unknown target" });
  return loadManifest(t);
});

app.listen({ host: HOST, port: PORT }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
