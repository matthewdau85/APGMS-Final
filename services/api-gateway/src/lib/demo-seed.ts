import crypto from "node:crypto";

import { hashPassword } from "@apgms/shared";
import { prisma } from "../db.js";
import { Decimal } from "@prisma/client/runtime/library.js";
import { encryptPII } from "./pii.js";

type SeedOptions = {
  daysBack?: number;
  mockDate?: Date;
};

const DEMO_ORG_ID = process.env.DEV_ADMIN_ORG_ID?.trim() ?? "11111111-1111-1111-1111-111111111111";

function dateDaysAgo(base: Date, offset: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() - offset);
  return next;
}

function buildBankLinePayload(orgId: string, date: Date, amount: number, label: string) {
  const payee = encryptPII(label);
  const desc = encryptPII(`Demo ${label}`);
  return {
    orgId,
    date,
    amount: new Decimal(amount),
    payeeCiphertext: payee.ciphertext,
    payeeKid: payee.kid,
    descCiphertext: desc.ciphertext,
    descKid: desc.kid,
    idempotencyKey: `demo-seed-${label}-${date.toISOString().slice(0, 10)}`,
  };
}

function buildEvidence(kind: string, orgId: string, payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  const sha256 = crypto.createHash("sha256").update(serialized).digest("hex");
  return {
    orgId,
    kind,
    payload,
    sha256,
    wormUri: `worm://demo/${kind}/${sha256.slice(0, 8)}`,
  };
}

export async function seedDemoOrg(options: SeedOptions = {}) {
  const today = options.mockDate ?? new Date();
  const daysBack = Math.min(Math.max(options.daysBack ?? 60, 30), 90);

  const org = await prisma.org.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: { id: DEMO_ORG_ID, name: "Demo Org" },
  });

  const [adminPassword, accountantPassword] = await Promise.all([
    hashPassword("admin-demo-pass"),
    hashPassword("accountant-demo-pass"),
  ]);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "demo.admin@example.com" },
      update: { orgId: org.id, role: "admin", mfaEnabled: true },
      create: {
        email: "demo.admin@example.com",
        password: adminPassword,
        orgId: org.id,
        role: "admin",
        mfaEnabled: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "demo.accountant@example.com" },
      update: { orgId: org.id, role: "accountant", mfaEnabled: false },
      create: {
        email: "demo.accountant@example.com",
        password: accountantPassword,
        orgId: org.id,
        role: "accountant",
        mfaEnabled: false,
      },
    }),
  ]);

  const employees = await Promise.all([
    prisma.employee.upsert({
      where: { id: "demo-emp-1" },
      update: {},
      create: (() => {
        const fullName = encryptPII("Demo Employee A");
        return {
          id: "demo-emp-1",
          orgId: org.id,
          fullNameCiphertext: fullName.ciphertext,
          fullNameKid: fullName.kid,
          employmentType: "full_time",
          baseRate: new Decimal(45),
          superRate: new Decimal(11),
          tfnProvided: true,
        };
      })(),
    }),
    prisma.employee.upsert({
      where: { id: "demo-emp-2" },
      update: {},
      create: (() => {
        const fullName = encryptPII("Demo Employee B");
        return {
          id: "demo-emp-2",
          orgId: org.id,
          fullNameCiphertext: fullName.ciphertext,
          fullNameKid: fullName.kid,
          employmentType: "part_time",
          baseRate: new Decimal(38),
          superRate: new Decimal(11),
          tfnProvided: true,
        };
      })(),
    }),
  ]);

  const designatedAccounts = await Promise.all([
    prisma.designatedAccount.upsert({
      where: { id: "demo-designated-paygw" },
      update: { balance: new Decimal("32500"), updatedAt: today, orgId: org.id, type: "PAYGW" },
      create: {
        id: "demo-designated-paygw",
        orgId: org.id,
        type: "PAYGW",
        balance: new Decimal("32500"),
        locked: false,
        updatedAt: today,
      },
    }),
    prisma.designatedAccount.upsert({
      where: { id: "demo-designated-gst" },
      update: { balance: new Decimal("18750"), updatedAt: today, orgId: org.id, type: "GST" },
      create: {
        id: "demo-designated-gst",
        orgId: org.id,
        type: "GST",
        balance: new Decimal("18750"),
        locked: false,
        updatedAt: today,
      },
    }),
  ]);

  const bankLines = Array.from({ length: daysBack }, (_, index) => {
    const date = dateDaysAgo(today, index);
    const amount = index % 4 === 0 ? -(950 + index * 3) : 1400 + index * 2;
    const label = amount < 0 ? "Payroll settlement" : "POS intake";
    return buildBankLinePayload(org.id, date, amount, label);
  });

  await prisma.bankLine.createMany({ data: bankLines, skipDuplicates: true });

  const payrollRuns = await Promise.all(
    Array.from({ length: Math.ceil(daysBack / 14) }, (_, runIndex) => {
      const base = dateDaysAgo(today, runIndex * 14);
      const gross = 18000 - runIndex * 500;
      const paygw = 4200 - runIndex * 120;
      return prisma.payRun.upsert({
        where: { id: `demo-payrun-${runIndex}` },
        update: { paymentDate: base, periodEnd: base },
        create: {
          id: `demo-payrun-${runIndex}`,
          orgId: org.id,
          periodStart: dateDaysAgo(base, 13),
          periodEnd: base,
          paymentDate: base,
          status: "committed",
          payslips: {
            create: (() => {
              const slipA = encryptPII("Demo payslip A");
              const slipB = encryptPII("Demo payslip B");
              return [
                {
                  id: `demo-slip-${runIndex}-1`,
                  employeeId: employees[0].id,
                  grossPay: new Decimal(gross / 2),
                  paygWithheld: new Decimal(paygw / 2),
                  superAccrued: new Decimal(1300),
                  notesCiphertext: slipA.ciphertext,
                  notesKid: slipA.kid,
                },
                {
                  id: `demo-slip-${runIndex}-2`,
                  employeeId: employees[1].id,
                  grossPay: new Decimal(gross / 2),
                  paygWithheld: new Decimal(paygw / 2),
                  superAccrued: new Decimal(1300),
                  notesCiphertext: slipB.ciphertext,
                  notesKid: slipB.kid,
                },
              ];
            })(),
          },
        },
      });
    }),
  );

  const gstTransactions = Array.from({ length: daysBack }, (_, index) => {
    const date = dateDaysAgo(today, index);
    const netCents = 125000 + index * 2500;
    const gstCents = Math.round(netCents * 0.1);
    return {
      orgId: org.id,
      txDate: date,
      netCents: BigInt(netCents),
      gstCents: BigInt(gstCents),
      code: "GST", // simple code for demo
    };
  });
  await prisma.gstTransaction.createMany({ data: gstTransactions, skipDuplicates: true });

  const basPeriods = await Promise.all([
    prisma.basPeriod.upsert({
      where: { id: `demo-bas-${today.getFullYear()}-Q1` },
      update: { status: "lodged", lodgedAt: dateDaysAgo(today, 30) },
      create: {
        id: `demo-bas-${today.getFullYear()}-Q1`,
        orgId: org.id,
        start: dateDaysAgo(today, 120),
        end: dateDaysAgo(today, 90),
        status: "lodged",
        lodgedAt: dateDaysAgo(today, 30),
        readyAt: dateDaysAgo(today, 35),
        releasedAt: dateDaysAgo(today, 32),
      },
    }),
    prisma.basPeriod.upsert({
      where: { id: `demo-bas-${today.getFullYear()}-Q2` },
      update: { status: "ready", readyAt: dateDaysAgo(today, 5) },
      create: {
        id: `demo-bas-${today.getFullYear()}-Q2`,
        orgId: org.id,
        start: dateDaysAgo(today, 90),
        end: dateDaysAgo(today, 1),
        status: "ready",
        readyAt: dateDaysAgo(today, 5),
      },
    }),
  ]);

  const alerts = await Promise.all([
    prisma.alert.create({
      data: {
        orgId: org.id,
        type: "PAYGW_SHORTFALL",
        severity: "high",
        message: "PAYGW capture lagging designated balance",
        createdAt: dateDaysAgo(today, 2),
      },
    }),
    prisma.alert.create({
      data: {
        orgId: org.id,
        type: "BAS_BLOCKER",
        severity: "medium",
        message: "Pending GST invoices awaiting evidence",
        createdAt: dateDaysAgo(today, 5),
        resolvedAt: null,
      },
    }),
  ]);

  const evidencePayloads = [
    buildEvidence("ledger_extract", org.id, {
      note: "Demo ledger extract",
      generatedAt: today.toISOString(),
      sample: bankLines.slice(0, 5).map((line) => ({
        date: line.date,
        amount: line.amount.toNumber(),
        payee: line.payeeCiphertext,
      })),
    }),
    buildEvidence("bas_supporting", org.id, {
      note: "Quarterly BAS support pack",
      basPeriods: basPeriods.map((bas) => ({ id: bas.id, status: bas.status })),
    }),
  ];

  const evidenceArtifacts = await prisma.$transaction(
    evidencePayloads.map((artifact, index) =>
      prisma.evidenceArtifact.upsert({
        where: { id: `demo-artifact-${index}` },
        update: artifact,
        create: { id: `demo-artifact-${index}`, ...artifact },
      }),
    ),
  );

  return {
    orgId: org.id,
    users: users.map((u) => ({ id: u.id, email: u.email, role: u.role, mfaEnabled: u.mfaEnabled })),
    bankLines: bankLines.length,
    payrollRuns: payrollRuns.length,
    gstDays: gstTransactions.length,
    basPeriods: basPeriods.length,
    alerts: alerts.length,
    evidenceArtifacts: evidenceArtifacts.length,
    designatedAccounts: designatedAccounts.length,
  };
}
