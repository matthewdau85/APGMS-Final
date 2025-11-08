#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const args = [
  "--filter",
  "@apgms/shared",
  "exec",
  "prisma",
  "migrate",
  "status",
  "--schema",
  "prisma/schema.prisma",
];

const child = spawn("pnpm", args, { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`check-prisma-drift terminated with signal ${signal}`);
    process.exit(1);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Failed to run pnpm for Prisma drift check:", error);
  process.exit(1);
});
