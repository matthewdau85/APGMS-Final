import type { DemoState, Organization, SettingsModel, Obligation, PeriodKey, TaxType, Incident, LedgerEntry, BankLine } from "./types.js";
import { checksumToy, id, makeRng, nowIso, pick, ymd } from "./types.js";

export type CaseStudyId = "cs_cafe_multi_site" | "cs_construction_contractor" | "cs_ecomm_high_volume";

export type CaseStudyDescriptor = {
  id: CaseStudyId;
  name: string;
  summary: string;
  cadence: "monthly" | "quarterly";
};

export const CASE_STUDIES: CaseStudyDescriptor[] = [
  {
    id: "cs_cafe_multi_site",
    name: "Cafe group (3 sites) - quarterly BAS, weekly payroll",
    summary: "Typical SME hospitality: steady card inflows, payroll weekly, super quarterly pressure, occasional shortfalls.",
    cadence: "quarterly",
  },
  {
    id: "cs_construction_contractor",
    name: "Construction contractor - lumpy invoices, PAYGW sensitivity",
    summary: "Irregular client payments, subcontractor outflows, higher risk of PAYGW funding gaps and reconciliation backlog.",
    cadence: "quarterly",
  },
  {
    id: "cs_ecomm_high_volume",
    name: "E-commerce brand - high volume, chargebacks, daily settlement",
    summary: "High transaction velocity, daily gateway settlements, chargebacks, frequent bank lines and evidence pack needs.",
    cadence: "monthly",
  },
];

function baseSettings(orgName: string, abn: string, cadence: "monthly" | "quarterly", seed: string): SettingsModel {
  return {
    organization: {
      name: orgName,
      abn,
      timeZone: "Australia/Brisbane",
      reportingCalendar: "standard",
    },
    periods: {
      cadence,
      reminderDaysBeforeDue: 14,
      dueDateRule: "standard",
    },
    accounts: {
      operatingAccountLabel: "Operating Account",
      taxBufferAccountLabel: "Tax Buffer (One-Way)",
      segregatedAccountEnabled: true,
    },
    integrations: {
      bankFeed: "connected_demo",
      accounting: "connected_demo",
      payroll: "connected_demo",
    },
    simulation: {
      enabled: false,
      feedIntervalSeconds: 45,
      seed,
    },
  };
}

function obligationsForPeriod(orgId: string, period: PeriodKey, cadence: "monthly" | "quarterly", baseline: Record<TaxType, number>): Obligation[] {
  // Due dates are illustrative for demo. You can align them later to ATO rules per entity type.
  const dueBase = cadence === "monthly" ? "2026-02-21" : "2026-04-28";
  const mk = (taxType: TaxType, label: string, dueDate: string, amountCents: number, status: Obligation["status"]): Obligation => ({
    id: `${orgId}_${taxType}_${period}`,
    orgId,
    period,
    taxType,
    label,
    dueDate,
    amountCents,
    status,
    blockers:
      status === "reconcile_pending"
        ? ["Reconciliation not cleared"]
        : status === "overdue_risk"
          ? ["Approaching due date: verify inputs"]
          : [],
  });

  return [
    mk("GST", `BAS ${period}`, dueBase, baseline.GST, "reconcile_pending"),
    mk("PAYGW", `PAYG Withholding ${period}`, cadence === "monthly" ? "2026-02-21" : "2026-04-21", baseline.PAYGW, "funded"),
    mk("PAYGI", `PAYG Instalment ${period}`, dueBase, baseline.PAYGI, "ready_to_lodge"),
    mk("SUPER", `Super Guarantee ${period}`, dueBase, baseline.SUPER, "funded"),
  ];
}

function incident(orgId: string, ts: number, title: string, severity: Incident["severity"], description: string, obligationIds: string[]): Incident {
  return {
    id: id("inc", ts, 1),
    orgId,
    ts,
    title,
    severity,
    description,
    obligationIds,
    status: "open",
  };
}

function ledgerEntry(orgId: string, ts: number, account: LedgerEntry["account"], direction: LedgerEntry["direction"], amountCents: number, memo: string, ref?: string): LedgerEntry {
  return {
    id: id("led", ts, Math.floor((ts % 1000) + 1)),
    orgId,
    ts,
    postedDate: ymd(ts),
    account,
    direction,
    amountCents,
    memo,
    ref,
  };
}

function bankLine(orgId: string, ts: number, description: string, amountCents: number): BankLine {
  return {
    id: id("bl", ts, Math.floor((ts % 1000) + 1)),
    orgId,
    ts,
    postedDate: ymd(ts),
    description,
    amountCents,
    status: "unreconciled",
  };
}

export function seedCaseStudy(caseId: CaseStudyId, orgId: string, seed: string, nowTs: number): DemoState {
  const rng = makeRng(seed);
  const org: Organization = {
    id: orgId,
    name:
      caseId === "cs_cafe_multi_site"
        ? "Harbour Brew Group Pty Ltd"
        : caseId === "cs_construction_contractor"
          ? "Coastal Civil & Build Pty Ltd"
          : "Northstar Commerce Pty Ltd",
    abn:
      caseId === "cs_cafe_multi_site"
        ? "12 345 678 901"
        : caseId === "cs_construction_contractor"
          ? "83 210 987 654"
          : "41 777 222 999",
    timeZone: "Australia/Brisbane",
    reportingCalendar: "standard",
  };

  const cadence = caseId === "cs_ecomm_high_volume" ? "monthly" : "quarterly";
  const settings = baseSettings(org.name, org.abn, cadence, seed);

  const period: PeriodKey = cadence === "monthly" ? "2026-01" : "2025-Q4";

  const baseline =
    caseId === "cs_cafe_multi_site"
      ? { GST: 1285000, PAYGW: 912000, PAYGI: 260000, SUPER: 540000 }
      : caseId === "cs_construction_contractor"
        ? { GST: 980000, PAYGW: 1325000, PAYGI: 340000, SUPER: 610000 }
        : { GST: 2480000, PAYGW: 1560000, PAYGI: 520000, SUPER: 740000 };

  const obligations = obligationsForPeriod(orgId, period, cadence, baseline);

  const ts0 = nowTs - 1000 * 60 * 30; // 30 min ago
  const ts1 = nowTs - 1000 * 60 * 10; // 10 min ago
  const ts2 = nowTs - 1000 * 60 * 2; // 2 min ago

  const bankLines: BankLine[] = [
    bankLine(orgId, ts0, pick(rng, ["Square settlement", "Tyro settlement", "Stripe payout"]), Math.floor(150000 + rng() * 800000)),
    bankLine(orgId, ts1, pick(rng, ["Payroll batch", "Wages transfer"]), -Math.floor(450000 + rng() * 1100000)),
    bankLine(orgId, ts2, pick(rng, ["ATO payment - PAYGW", "Tax buffer transfer"]), -Math.floor(200000 + rng() * 600000)),
  ];

  const ledger: LedgerEntry[] = [
    ledgerEntry(orgId, ts0, "operating", "credit", Math.abs(bankLines[0].amountCents), "Settlement inflow", bankLines[0].id),
    ledgerEntry(orgId, ts1, "operating", "debit", Math.abs(bankLines[1].amountCents), "Payroll run", bankLines[1].id),
    ledgerEntry(orgId, ts2, "tax_buffer", "debit", Math.abs(bankLines[2].amountCents), "Tax remittance", bankLines[2].id),
  ];

  const incidents: Incident[] = [];
  if (caseId === "cs_construction_contractor") {
    incidents.push(
      incident(
        orgId,
        nowTs - 1000 * 60 * 6,
        "PAYGW funding gap risk",
        "high",
        "Client payment delay detected. Recommended: increase weekly tax buffer allocation and run reconciliation.",
        [obligations.find((o) => o.taxType === "PAYGW")!.id],
      ),
    );
  }
  if (caseId === "cs_ecomm_high_volume") {
    incidents.push(
      incident(
        orgId,
        nowTs - 1000 * 60 * 5,
        "Chargeback spike",
        "medium",
        "Chargeback rate exceeded demo threshold. Review settlements and evidence pack scope for BAS inputs.",
        [obligations.find((o) => o.taxType === "GST")!.id],
      ),
    );
  }

  const seededMarker = `${caseId}|${orgId}|${seed}|${period}|${nowIso(nowTs)}`;
  const checksum = checksumToy(seededMarker);

  return {
    org,
    settings,
    events: [
      {
        id: id("evt", nowTs, 1),
        ts: nowTs,
        type: "DEMO_SEEDED",
        orgId,
        period,
        message: `Seeded case study ${caseId} (${org.name})`,
        data: { caseId, checksum },
      },
    ],
    obligations,
    bankLines,
    ledger,
    evidencePacks: [],
    incidents,
  };
}
