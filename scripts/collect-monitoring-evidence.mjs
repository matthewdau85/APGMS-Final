import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const token = process.env.APIGMS_MONITORING_TOKEN;

if (!token) {
  throw new Error("APIGMS_MONITORING_TOKEN is required");
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = join("artifacts", "monitoring", timestamp);
await mkdir(outputDir, { recursive: true });

const endpoints = [
  { path: "/monitor/compliance", file: "compliance.json" },
  { path: "/monitor/risk", file: "risk.json" },
];

for (const endpoint of endpoints) {
  const response = await fetch(`${baseUrl}${endpoint.path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await response.text();
  await writeFile(join(outputDir, endpoint.file), body, "utf-8");
}

console.info(`Saved monitoring evidence to ${outputDir}`);
