import net from "node:net";

const host = process.argv[2] || "127.0.0.1";
const port = Number(process.argv[3] || "5432");
const timeoutMs = Number(process.argv[4] || "60000");

const start = Date.now();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryConnect() {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1500);

    const done = (ok) => {
      try { s.destroy(); } catch {}
      resolve(ok);
    };

    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));

    s.connect(port, host);
  });
}

(async () => {
  while (Date.now() - start < timeoutMs) {
    const ok = await tryConnect();
    if (ok) {
      process.stdout.write(`OK: TCP ${host}:${port}\n`);
      process.exit(0);
    }
    await sleep(250);
  }

  process.stderr.write(`ERROR: Timed out waiting for TCP ${host}:${port} after ${timeoutMs}ms\n`);
  process.exit(1);
})();
