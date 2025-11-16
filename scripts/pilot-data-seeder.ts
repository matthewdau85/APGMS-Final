import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface CliOptions {
  baseUrl: string;
  token: string;
  orgId: string;
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    baseUrl: process.env.APGMS_API_URL ?? "http://localhost:3000",
    token: process.env.APGMS_API_TOKEN ?? "",
    orgId: process.env.APGMS_ORG_ID ?? "demo-org",
  };

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) continue;
    switch (key) {
      case "--base-url":
        options.baseUrl = value;
        i += 1;
        break;
      case "--token":
        options.token = value;
        i += 1;
        break;
      case "--org":
        options.orgId = value;
        i += 1;
        break;
      default:
        break;
    }
  }

  if (!options.token) {
    throw new Error("Provide an API token via --token or APGMS_API_TOKEN");
  }

  return options;
}

async function apiPost<T>(options: CliOptions, path: string, body: unknown): Promise<T> {
  const url = `${options.baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${path} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

async function main() {
  const options = parseArgs();
  const timestamp = new Date().toISOString();

  const payroll = await apiPost<{ payRunId: string; totalPaygWithheld: number }>(
    options,
    "/demo/payroll/run",
    { includeBankLines: true, note: "pilot" },
  );

  const stp = await apiPost<unknown>(options, "/ato/stp/report", {
    orgId: options.orgId,
    payRunId: payroll.payRunId,
  });

  const compliance = await apiPost<unknown>(options, "/compliance/precheck", {
    orgId: options.orgId,
  });

  const artifact = {
    generatedAt: timestamp,
    orgId: options.orgId,
    payroll,
    stp,
    compliance,
  };

  const dir = join(process.cwd(), "artifacts", "pilots", options.orgId);
  await mkdir(dir, { recursive: true });
  const target = join(dir, `pilot-${timestamp.replace(/[:.]/g, "-")}.json`);
  await writeFile(target, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`✅ Pilot data stored at ${target}`);
}

main().catch((error) => {
  console.error("Pilot seeder failed", error);
  process.exitCode = 1;
});
