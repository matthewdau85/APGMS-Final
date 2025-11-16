#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function runGit(args, options = {}) {
  return spawnSync("git", args, {
    stdio: "pipe",
    encoding: "utf8",
    ...options,
  });
}

function ensureSuccess(result, step) {
  if (result.status === 0) {
    return;
  }

  const output = result.stderr?.trim() ?? "";
  if (output.length > 0) {
    console.error(output);
  }
  console.error(`git ${step} failed with exit code ${result.status ?? 1}`);
  process.exit(result.status ?? 1);
}

function parseUpstream(ref) {
  if (!ref) return null;
  const slashIndex = ref.indexOf("/");
  if (slashIndex <= 0 || slashIndex === ref.length - 1) {
    return null;
  }

  return {
    remote: ref.slice(0, slashIndex),
    remoteBranch: ref.slice(slashIndex + 1),
  };
}

function formatSummaryRow(entry) {
  const details = entry.details ? ` (${entry.details})` : "";
  return `- ${entry.branch}: ${entry.status}${details}`;
}

function logSection(title) {
  console.log("\n" + title);
  console.log("=".repeat(title.length));
}

(function main() {
  logSection("Fetching remote updates");
  const fetchAll = runGit(["fetch", "--all", "--prune"], { stdio: "inherit" });
  ensureSuccess(fetchAll, "fetch --all --prune");

  const listResult = runGit([
    "for-each-ref",
    "--format=%(refname:short)::%(upstream:short)",
    "refs/heads",
  ]);
  ensureSuccess(listResult, "for-each-ref");

  const branches = listResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [branch, upstream] = line.split("::");
      return { branch, upstream: upstream?.length ? upstream : null };
    });

  if (branches.length === 0) {
    console.log("No local branches found.");
    return;
  }

  const summary = [];
  let hasFailures = false;

  logSection("Updating branches");
  for (const entry of branches) {
    if (!entry.upstream) {
      summary.push({ branch: entry.branch, status: "skipped", details: "no upstream" });
      continue;
    }

    const upstream = parseUpstream(entry.upstream);
    if (!upstream) {
      summary.push({ branch: entry.branch, status: "skipped", details: "invalid upstream" });
      continue;
    }

    console.log(`Updating ${entry.branch} from ${entry.upstream}...`);
    const result = runGit(
      ["fetch", "--update-head-ok", upstream.remote, `${upstream.remoteBranch}:${entry.branch}`],
      { stdio: "inherit" },
    );

    if (result.status === 0) {
      summary.push({ branch: entry.branch, status: "updated", details: null });
      continue;
    }

    hasFailures = true;
    const detail = result.stderr?.trim() || `git fetch exited with ${result.status}`;
    summary.push({ branch: entry.branch, status: "failed", details: detail });
  }

  logSection("Summary");
  summary.forEach((row) => console.log(formatSummaryRow(row)));

  if (hasFailures) {
    process.exit(1);
  }
})();
