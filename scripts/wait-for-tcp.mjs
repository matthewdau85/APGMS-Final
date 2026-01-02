import net from "node:net";

const host = process.argv[2] ?? "127.0.0.1";
const port = Number(process.argv[3] ?? "5432");
const timeoutMs = Number(process.argv[4] ?? "30000");

const start = Date.now();

function tryOnce() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

while (true) {
  // eslint-disable-next-line no-await-in-loop
  const ok = await tryOnce();
  if (ok) process.exit(0);

  if (Date.now() - start > timeoutMs) {
    console.error(`Timeout waiting for TCP ${host}:${port}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-await-in-loop
  await new Promise((r) => setTimeout(r, 250));
}
