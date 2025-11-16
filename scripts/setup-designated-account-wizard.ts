import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join } from "node:path";

const PROVIDERS = [
  { id: "anz", label: "Australia & New Zealand Banking Group" },
  { id: "nab", label: "National Australia Bank" },
  { id: "cba", label: "Commonwealth Bank of Australia" },
  { id: "wbc", label: "Westpac Banking Corporation" },
  { id: "mock", label: "Mock provider (sandbox)" },
] as const;

type WizardAnswers = {
  orgId: string;
  providerId: (typeof PROVIDERS)[number]["id"];
  paygwAccount: string;
  gstAccount: string;
  contactEmail: string;
};

function sanitize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

async function ask(question: string, ci: ReturnType<typeof createInterface>): Promise<string> {
  const answer = (await ci.question(`${question.trim()} `)).trim();
  if (!answer) {
    return ask(question, ci);
  }
  return answer;
}

function buildPayToMandate(answer: WizardAnswers) {
  return {
    mandateId: randomUUID(),
    orgId: answer.orgId,
    providerId: answer.providerId,
    webhook: {
      url: `${process.env.APGMS_PAYTO_WEBHOOK ?? "https://api.example.com"}/payto/${answer.orgId}`,
      sharedSecret: randomUUID().replace(/-/g, ""),
    },
    constraints: {
      direction: "credit-only",
      maxDebitCents: 0,
      description: "Designated account pay-in only mandate",
    },
    contacts: [
      {
        type: "operations",
        email: answer.contactEmail,
      },
    ],
  } as const;
}

function buildDesignatedAccountPlan(answer: WizardAnswers, mandate: ReturnType<typeof buildPayToMandate>) {
  const timestamp = new Date().toISOString();
  return {
    generatedAt: timestamp,
    orgId: answer.orgId,
    providerId: answer.providerId,
    designatedAccounts: {
      paygw: answer.paygwAccount,
      gst: answer.gstAccount,
    },
    controls: {
      ledgerPolicy: "applyDesignatedAccountTransfer",
      idempotencyRequired: true,
      paytoMandateId: mandate.mandateId,
    },
    automation: {
      payto: mandate,
      monitoringWebhook: `${process.env.APGMS_MONITORING_WEBHOOK ?? "https://api.example.com"}/designated/${answer.orgId}`,
    },
  };
}

async function persistArtifacts(plan: ReturnType<typeof buildDesignatedAccountPlan>) {
  const baseDir = join(process.cwd(), "artifacts", "onboarding");
  await mkdir(baseDir, { recursive: true });
  const filePath = join(baseDir, `${plan.orgId}-designated-plan.json`);
  await writeFile(filePath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return filePath;
}

async function runWizard() {
  const cli = createInterface({ input, output });
  try {
    const orgId = sanitize(await ask("Organisation ID (e.g. org-prod-01):", cli));
    const email = await ask("Primary compliance contact email:", cli);
    console.log("\nSelect banking provider:");
    PROVIDERS.forEach((provider, index) => {
      console.log(`  [${index + 1}] ${provider.label} (${provider.id.toUpperCase()})`);
    });
    const providerChoice = Number.parseInt(
      await ask("Enter provider number:", cli),
      10,
    );
    const provider = PROVIDERS[providerChoice - 1] ?? PROVIDERS[0];
    const paygwAccount = await ask("PAYGW designated account number:", cli);
    const gstAccount = await ask("GST designated account number:", cli);

    const answers: WizardAnswers = {
      orgId,
      providerId: provider.id,
      paygwAccount,
      gstAccount,
      contactEmail: email,
    };

    const mandate = buildPayToMandate(answers);
    const plan = buildDesignatedAccountPlan(answers, mandate);
    const artifactPath = await persistArtifacts(plan);

    console.log("\n✅ Designated account plan generated:");
    console.log(`   • Provider: ${provider.label}`);
    console.log(`   • PAYGW account: ${paygwAccount}`);
    console.log(`   • GST account: ${gstAccount}`);
    console.log(`   • PayTo mandate: ${mandate.mandateId}`);
    console.log(`   • Saved to: ${artifactPath}`);
  } finally {
    cli.close();
  }
}

runWizard().catch((error) => {
  console.error("Setup wizard failed", error);
  process.exitCode = 1;
});
