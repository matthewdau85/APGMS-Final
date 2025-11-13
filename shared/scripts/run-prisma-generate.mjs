import { spawn } from "node:child_process";
import { rm, readdir } from "node:fs/promises";
import { join } from "node:path";

const env = { ...process.env };

if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/apgms?schema=public";
}

if (!env.SHADOW_DATABASE_URL) {
  env.SHADOW_DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/apgms_shadow?schema=public";
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = ["exec", "prisma", "generate", "--schema", "prisma/schema.prisma"];

const runner =
  process.platform === "win32"
    ? ["cmd.exe", "/d", "/s", "/c", command, ...args]
    : [command, ...args];

const cleanClient = async () => {
  const dir = join(process.cwd(), "..", "node_modules", ".pnpm");
  try {
    const entries = await readdir(dir);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith("@prisma+client@"))
        .map((entry) => rm(join(dir, entry), { recursive: true, force: true })),
    );
  } catch {
    // ignore missing directory/errors
  }
};

await cleanClient();

const child = spawn(runner[0], runner.slice(1), {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});