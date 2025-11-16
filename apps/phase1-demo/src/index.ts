import Fastify from "fastify";
import { AccountSubtype, AccountType, PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";

import { JournalWriter } from "@apgms/ledger";
import type { BusEnvelope } from "@apgms/shared";
import { NatsBus } from "@apgms/shared";

const prisma = new PrismaClient();

const config = {
  port: Number(process.env.PORT ?? 3001),
  orgId: process.env.DEMO_ORG_ID ?? "11111111-1111-1111-1111-111111111111",
  natsUrl: process.env.NATS_URL ?? "nats://localhost:4222",
  natsStream: process.env.NATS_STREAM ?? "APGMS",
  subjectPrefix: process.env.NATS_SUBJECT_PREFIX ?? "apgms.dev",
  schemaVersion: "apgms.tax.v3",
};

const subjects = {
  payrollIngested: `${config.subjectPrefix}.payroll.ingested`,
  reconAlert: `${config.subjectPrefix}.recon.alert`,
};

const ledgerWriter = new JournalWriter(prisma);

async function main(): Promise<void> {
  const nats = await NatsBus.connect({
    url: config.natsUrl,
    stream: config.natsStream,
    subjectPrefix: config.subjectPrefix,
  });

  await ensureOrganization(config.orgId);
  const accounts = await ensureBaselineAccounts(config.orgId);

  await nats.subscribe(subjects.payrollIngested, "ledger-payroll", async (message) => {
    const payload = message.payload as PayrollPayload;
    const amount = BigInt(payload.paygwCents);

    await ledgerWriter.write({
      orgId: message.orgId,
      eventId: message.id,
      dedupeId: message.dedupeId,
      type: "PAYROLL_HOLD",
      occurredAt: new Date(message.ts),
      source: message.source,
      postings: [
        { accountId: accounts.paygwBuffer.id, amountCents: -amount },
        { accountId: accounts.clearing.id, amountCents: amount },
      ],
    });
  });

  if (process.env.DEMO_PUBLISH === "true") {
    await publishSyntheticPayroll(nats, subjects.payrollIngested, config.orgId);
  }

  const app = Fastify();

  app.get("/ready", async () => {
    await prisma.$queryRaw`SELECT 1`;
    await nats.ping();
    return { ok: true };
  });

  app.get<{
    Params: { code: string };
  }>("/balances/:code", async (request, reply) => {
    const { code } = request.params;
    const account = await prisma.account.findFirst({ where: { orgId: config.orgId, code } });
    if (!account) {
      reply.code(404).send({ error: "account not found" });
      return;
    }

    const aggregate = await prisma.posting.aggregate({
      where: { orgId: config.orgId, accountId: account.id },
      _sum: { amountCents: true },
    });

    reply.send({
      account: code,
      balanceCents: (aggregate._sum.amountCents ?? 0n).toString(),
    });
  });

  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`Phase 1 demo listening on ${address}`);

  const shutdown = async () => {
    await app.close();
    await nats.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Phase 1 demo failed", error);
  await prisma.$disconnect();
  process.exit(1);
});

type PayrollPayload = {
  payrollId: string;
  paygwCents: number;
  grossCents: number;
};

async function publishSyntheticPayroll(bus: NatsBus, subject: string, orgId: string): Promise<void> {
  const envelope: BusEnvelope<PayrollPayload> = {
    id: uuidv7(),
    orgId,
    eventType: "payroll.ingested",
    key: orgId,
    ts: new Date().toISOString(),
    schemaVersion: config.schemaVersion,
    source: "adapter/payroll",
    dedupeId: uuidv7(),
    payload: {
      payrollId: uuidv7(),
      grossCents: 8_500_00,
      paygwCents: 1_700_00,
    },
  };

  await bus.publish(subject, envelope);
}

async function ensureOrganization(orgId: string): Promise<void> {
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: "APGMS Demo Org", tier: "Monitor" },
  });
}

async function ensureBaselineAccounts(orgId: string) {
  const codes = [
    { code: "1000", name: "BANK:Operating", type: AccountType.ASSET, subtype: AccountSubtype.BANK },
    {
      code: "2000",
      name: "LIABILITY:PAYGW_BUFFER",
      type: AccountType.LIABILITY,
      subtype: AccountSubtype.PAYGW_BUFFER,
    },
    {
      code: "2100",
      name: "LIABILITY:GST_BUFFER",
      type: AccountType.LIABILITY,
      subtype: AccountSubtype.GST_BUFFER,
    },
    {
      code: "2200",
      name: "LIABILITY:CLEARING:BAS",
      type: AccountType.LIABILITY,
      subtype: AccountSubtype.CLEARING,
    },
    { code: "9999", name: "SUSPENSE:RECON", type: AccountType.EXPENSE, subtype: AccountSubtype.SUSPENSE },
  ];

  const records = await Promise.all(
    codes.map(async (entry) =>
      prisma.account.upsert({
        where: { orgId_code: { orgId, code: entry.code } },
        update: {},
        create: {
          orgId,
          code: entry.code,
          name: entry.name,
          type: entry.type,
          subtype: entry.subtype,
        },
      }),
    ),
  );

  return {
    bank: records[0],
    paygwBuffer: records[1],
    gstBuffer: records[2],
    clearing: records[3],
    suspense: records[4],
  };
}
