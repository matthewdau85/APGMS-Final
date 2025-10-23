#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
let tag = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tag" && args[i + 1]) {
    tag = args[i + 1];
    break;
  }
}

const baseUrl = process.env.EVIDENCE_BASE_URL ?? "http://localhost:3000";
const skipK6 = process.env.SKIP_K6 === "true";

const commands = [
  {
    title: "pnpm -r test",
    cmd: ["pnpm", "-r", "test"],
  },
  {
    title: "pnpm -r typecheck",
    cmd: ["pnpm", "-r", "typecheck"],
  },
  {
    title: "pnpm --filter @apgms/shared exec prisma migrate status --schema prisma/schema.prisma",
    cmd: [
      "pnpm",
      "--filter",
      "@apgms/shared",
      "exec",
      "prisma",
      "migrate",
      "status",
      "--schema",
      "prisma/schema.prisma",
    ],
  },
];

if (!skipK6) {
  commands.push({
    title: `pnpm k6:smoke -- --env BASE_URL=${baseUrl}`,
    cmd: ["pnpm", "k6:smoke", "--", "--env", `BASE_URL=${baseUrl}`],
  });
}

const evidenceDir = resolve("artifacts", "compliance");
mkdirSync(evidenceDir, { recursive: true });

let report = `# Compliance Evidence\n\n`;
report += `- Timestamp: ${new Date().toISOString()}\n`;
report += `- Git commit: ${runCommand("git", ["rev-parse", "HEAD"]).stdout.trim()}\n`;
report += `- Tag: ${tag}\n`;
report += `- Base URL: ${baseUrl}\n`;
report += `- Skip k6: ${skipK6}\n\n`;

for (const { title, cmd } of commands) {
  report += `## ${title}\n\n`;
  const { stdout, stderr, status } = runCommand(cmd[0], cmd.slice(1));
  report += `- Exit code: ${status}\n\n`;
  if (stdout.trim().length > 0) {
    report += "```text\n";
    report += stdout.trim();
    report += "\n```\n\n";
  } else {
    report += "_No stdout output_\n\n";
  }
  if (stderr.trim().length > 0) {
    report += "```text\n";
    report += stderr.trim();
    report += "\n```\n\n";
  }
}

const filePath = resolve(evidenceDir, `${tag}.md`);
writeFileSync(filePath, report, "utf8");
console.log(`Evidence written to ${filePath}`);

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: typeof result.status === "number" ? result.status : 1,
  };
}
