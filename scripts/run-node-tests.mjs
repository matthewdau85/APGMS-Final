#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const defaults = [];
const passthrough = [];
const runByPath = [];

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--default") {
    const next = argv[i + 1];
    if (next) {
      defaults.push(next);
      i += 1;
    }
  } else if (arg === "--runTestsByPath") {
    const next = argv[i + 1];
    if (next) {
      runByPath.push(next);
      i += 1;
    }
  } else {
    passthrough.push(arg);
  }
}

const targetArgs = runByPath.length > 0
  ? runByPath
  : (passthrough.length > 0 ? passthrough : defaults);

const hasGlob = (value) => /[*?[\]]/.test(value);

const resolvedTargets = targetArgs.map((target) =>
  hasGlob(target) ? target : resolve(process.cwd(), target),
);

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["exec", "tsx", "--test", ...resolvedTargets], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
