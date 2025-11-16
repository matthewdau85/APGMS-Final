import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

async function loadPlan(filePath: string) {
  const absolute = resolve(filePath);
  const raw = await readFile(absolute, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.orgId || !parsed.automation?.payto) {
    throw new Error("Plan is missing orgId or payto automation payload");
  }
  return parsed;
}

function buildRequestBody(plan: any) {
  const mandate = plan.automation.payto;
  return {
    orgId: plan.orgId,
    providerId: plan.providerId,
    designatedAccounts: plan.designatedAccounts,
    controls: plan.controls,
    webhook: mandate.webhook,
    paytoMandate: {
      id: mandate.mandateId,
      constraints: mandate.constraints,
      contacts: mandate.contacts,
    },
    generatedAt: plan.generatedAt,
  };
}

async function persistEvidence(orgId: string, payload: unknown, response: any) {
  const baseDir = resolve(process.cwd(), "artifacts", "onboarding");
  await mkdir(baseDir, { recursive: true });
  const filePath = join(baseDir, `${orgId}-payto-automation.json`);
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        payload,
        response,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return filePath;
}

async function configurePayto(planPath: string) {
  const plan = await loadPlan(planPath);
  const endpoint =
    process.env.APGMS_PAYTO_CONFIG_ENDPOINT ??
    "https://api.example.com/payto/automation";
  const token = process.env.PAYTO_SETUP_TOKEN ?? "local-dev";

  const payload = buildRequestBody(plan);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Org-Id": plan.orgId,
    },
    body: JSON.stringify(payload),
  });

  const result = {
    status: response.status,
    body: await response.text(),
  };

  if (!response.ok) {
    throw new Error(
      `PayTo automation request failed (${response.status}): ${result.body}`,
    );
  }

  const artifactPath = await persistEvidence(plan.orgId, payload, result);
  console.log("\n✅ PayTo automation configured");
  console.log(`   • Org: ${plan.orgId}`);
  console.log(`   • Provider: ${plan.providerId}`);
  console.log(`   • Endpoint: ${endpoint}`);
  console.log(`   • Evidence: ${artifactPath}`);
}

async function main() {
  const [, , planPathArg] = process.argv;
  if (!planPathArg) {
    throw new Error(
      "Usage: pnpm setup:payto <path-to-designated-plan.json>",
    );
  }

  await configurePayto(planPathArg);
}

main().catch((error) => {
  console.error("PayTo automation failed", error);
  process.exitCode = 1;
});
