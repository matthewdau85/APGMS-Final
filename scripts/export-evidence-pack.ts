import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

type CliOptions = {
  baseUrl: string;
  token: string;
  orgId: string;
  outDir: string;
};

function parseArgs(): CliOptions {
  const defaults = {
    baseUrl: process.env.APGMS_API_URL ?? "http://localhost:3000",
    orgId: process.env.APGMS_ORG_ID ?? "dev-org",
    outDir: process.env.APGMS_EXPORT_DIR ?? "artifacts/backups",
    token: process.env.APGMS_API_TOKEN ?? "",
  };

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) {
      continue;
    }
    switch (key) {
      case "--base-url":
        defaults.baseUrl = value;
        i += 1;
        break;
      case "--token":
        defaults.token = value;
        i += 1;
        break;
      case "--org":
        defaults.orgId = value;
        i += 1;
        break;
      case "--out":
        defaults.outDir = value;
        i += 1;
        break;
      default:
        break;
    }
  }

  if (!defaults.token) {
    throw new Error(
      "API token missing. Provide --token argument or set APGMS_API_TOKEN.",
    );
  }

  return defaults;
}

async function fetchJson<T>(baseUrl: string, path: string, token: string): Promise<T> {
  const target = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(target, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Request to ${path} failed (${response.status}): ${text || "no response body"}`,
    );
  }

  return response.json() as Promise<T>;
}

async function main() {
  const options = parseArgs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(process.cwd(), options.outDir);
  const targetFile = join(outDir, `evidence-pack_${options.orgId}_${timestamp}.json`);

  await mkdir(outDir, { recursive: true });

  const [orgExport, complianceReport] = await Promise.all([
    fetchJson<unknown>(
      options.baseUrl,
      `/admin/export/${encodeURIComponent(options.orgId)}`,
      options.token,
    ),
    fetchJson<unknown>(options.baseUrl, "/compliance/report", options.token),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    orgId: options.orgId,
    inputs: {
      baseUrl: options.baseUrl,
    },
    export: orgExport,
    compliance: complianceReport,
  };

  await writeFile(targetFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  // eslint-disable-next-line no-console
  console.log(`✅ Evidence pack written to ${targetFile}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to generate evidence pack:", error);
  process.exitCode = 1;
});
