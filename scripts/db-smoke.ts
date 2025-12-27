import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for db-smoke");
  }

  const prisma = new PrismaClient();

  // Retry loop (service containers sometimes take a moment)
  const maxAttempts = 20;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      // Deterministic, minimal query
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
      await prisma.$disconnect();
      console.log("✅ DB smoke passed");
      return;
    } catch (err) {
      lastErr = err;
      try {
        await prisma.$disconnect();
      } catch {
        // ignore
      }
      process.stderr.write(`DB not ready (attempt ${attempt}/${maxAttempts})\n`);
      await sleep(500);
    }
  }

  throw new Error(`DB smoke failed after ${maxAttempts} attempts: ${String(lastErr)}`);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
