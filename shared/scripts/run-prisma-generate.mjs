import { spawn } from "node:child_process";

const env = { ...process.env };

if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/apgms?schema=public";
}

if (!env.SHADOW_DATABASE_URL) {
  env.SHADOW_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/apgms_shadow?schema=public";
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = ["exec", "prisma", "generate", "--schema", "prisma/schema.prisma"];

const child = spawn(command, args, {
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
