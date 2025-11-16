import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { AccountSubtype, AccountType, Prisma, PrismaClient, type DesignatedAccount } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { applyDesignatedAccountTransfer } from "@apgms/domain-policy";
import { startNatsIngestionConsumer } from "@apgms/ingestion-nats";
import { JournalWriter } from "@apgms/ledger";
import { computeTierStatus, exponentialMovingAverage } from "@apgms/shared/ledger/predictive";
import type { BusEnvelope } from "@apgms/shared";
import { NatsBus } from "@apgms/shared";
import {
  fetchAccountBalance,
  generateDemoReconciliationArtifact,
  hashObject,
} from "./lib/reports.js";

const prisma = new PrismaClient();
const ledgerWriter = new JournalWriter(prisma);

const config = loadConfig();

const subjects = {
  payrollIngested: `${config.subjectPrefix}.payroll.ingested`,
};

const transferSchema = z.object({
  paygwCents: z.number().int().nonnegative(),
  gstCents: z.number().int().nonnegative(),
  paygiCents: z.number().int().nonnegative().optional().default(0),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  orgId: z.string().uuid().optional(),
});

const MAX_FORECAST_POINTS = 12;
const EWMA_ALPHA = 0.6;

async function main(): Promise<void> {
  const nats = await NatsBus.connect({
    url: config.natsUrl,
    stream: config.natsStream,
    subjectPrefix: config.subjectPrefix,
  });

  await ensureOrganization(config.orgId);
  const accounts = await ensureBaselineAccounts(config.orgId);
  const designated = await ensureDesignatedAccounts(config.orgId);

  const payrollConsumer = await startNatsIngestionConsumer<PayrollPayload>({
    bus: nats,
    subject: subjects.payrollIngested,
    durableName: "demo-ledger-payroll",
    handler: async (message: BusEnvelope<PayrollPayload>) =>
      handlePayrollIngest(message, accounts, designated).catch((error) => {
        // eslint-disable-next-line no-console
        console.error("demo.payroll_ingest_failed", { error });
        throw error;
      }),
  });

  if (process.env.DEMO_PUBLISH === "true") {
    await publishSyntheticPayroll(nats, subjects.payrollIngested, config.orgId);
  }

  const app = Fastify();
  const authenticate = createAuthGuard(config.jwtSecret, config.jwtAudience, config.jwtIssuer);

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ error: "invalid_login_request" });
      return;
    }
    if (body.data.password !== config.loginSecret) {
      reply.code(401).send({ error: "invalid_credentials" });
      return;
    }

    const orgId = body.data.orgId ?? config.orgId;
    const token = jwt.sign(
      { sub: body.data.username, orgId, role: "admin" },
      config.jwtSecret,
      {
        algorithm: "HS256",
        audience: config.jwtAudience,
        issuer: config.jwtIssuer,
        expiresIn: "1h",
      },
    );

    reply.send({ token, expiresIn: "1h" });
  });

  app.get("/ready", { preHandler: authenticate }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    await nats.ping();
    return { ok: true };
  });

  app.get<{ Params: { code: string } }>("/balances/:code", { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.params;
    const account = await prisma.account.findFirst({ where: { orgId: config.orgId, code } });
    if (!account) {
      reply.code(404).send({ error: "account_not_found" });
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

  app.get("/demo/forecast", { preHandler: authenticate }, async (request, reply) => {
    const balances = await getBufferBalances(accounts);
    const forecast = await forecastDemoObligations(config.orgId, accounts);
    reply.send({
      generatedAt: new Date().toISOString(),
      balances,
      forecast,
      tierStatus: {
        paygw: computeTierStatus(balances.paygwDollars, forecast.paygwForecast),
        gst: computeTierStatus(balances.gstDollars, forecast.gstForecast),
      },
    });
  });

  app.post("/demo/transfer", { preHandler: authenticate }, async (request, reply) => {
    const body = transferSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ error: "invalid_transfer" });
      return;
    }

    const idempotencyKey = request.headers["idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      reply.code(400).send({ error: "idempotency_key_required" });
      return;
    }

    const payloadHash = hashObject(body.data);
    const prior = await prisma.idempotencyEntry.findFirst({
      where: { orgId: config.orgId, key: idempotencyKey },
    });

    if (prior) {
      if (prior.requestHash !== payloadHash) {
        reply.code(409).send({ error: "idempotency_conflict" });
        return;
      }
      reply.code(prior.statusCode).send(prior.responsePayload ?? { status: "replayed" });
      return;
    }

    const precheck = await runPrecheck(accounts, body.data);
    if (!precheck.ok) {
      reply.code(409).send({ status: "shortfall", shortfalls: precheck.shortfalls });
      return;
    }

    const journal = await executeClearingTransfer(
      request.user?.sub ?? "demo-system",
      accounts,
      designated,
      body.data,
    );
    const artifact = await generateReconciliationArtifact(accounts);

    const response = {
      status: "transferred",
      journalId: journal.journal.id,
      artifact,
    };

    await prisma.idempotencyEntry.create({
      data: {
        orgId: config.orgId,
        actorId: request.user?.sub ?? "demo-system",
        key: idempotencyKey,
        requestHash: payloadHash,
        responseHash: hashObject(response),
        statusCode: 200,
        responsePayload: response,
      },
    });

    reply.send(response);
  });

  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`Phase 1 demo listening on ${address}`);

  const shutdown = async () => {
    await app.close();
    await payrollConsumer.stop();
    await nats.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

const entryFileUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryFileUrl === import.meta.url) {
  main().catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Phase 1 demo failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
}

type PayrollPayload = {
  payrollId: string;
  paygwCents: number;
  gstCents?: number;
  paygiCents?: number;
  grossCents: number;
};

type BaselineAccounts = Awaited<ReturnType<typeof ensureBaselineAccounts>>;

type Designated = Awaited<ReturnType<typeof ensureDesignatedAccounts>>;

type TransferInput = z.infer<typeof transferSchema>;

export function loadConfig() {
  const requireEnv = (name: string, defaultValue?: string) => {
    const value = process.env[name] ?? defaultValue;
    if (!value) {
      throw new Error(`${name} is required`);
    }
    return value;
  };

  return {
    port: Number(process.env.PORT ?? 3001),
    orgId: requireEnv("DEMO_ORG_ID", "11111111-1111-1111-1111-111111111111"),
    natsUrl: requireEnv("NATS_URL", "nats://localhost:4222"),
    natsStream: requireEnv("NATS_STREAM", "APGMS"),
    subjectPrefix: requireEnv("NATS_SUBJECT_PREFIX", "apgms.dev"),
    jwtSecret: requireEnv("DEMO_JWT_SECRET"),
    jwtIssuer: process.env.DEMO_JWT_ISSUER ?? "urn:apgms:demo",
    jwtAudience: process.env.DEMO_JWT_AUDIENCE ?? "urn:apgms:demo",
    loginSecret: requireEnv("DEMO_LOGIN_SECRET"),
    schemaVersion: process.env.DEMO_SCHEMA_VERSION ?? "apgms.tax.v3",
  };
}

function createAuthGuard(secret: string, audience: string, issuer: string) {
  return async function authGuard(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const token = header.slice("Bearer ".length);
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"], audience, issuer });
      request.user = {
        sub: typeof decoded.sub === "string" ? decoded.sub : "demo-user",
        orgId: typeof decoded === "object" && decoded !== null && typeof (decoded as any).orgId === "string"
          ? (decoded as any).orgId
          : config.orgId,
        role: "admin",
      };
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  };
}

async function handlePayrollIngest(
  message: BusEnvelope<PayrollPayload>,
  accounts: BaselineAccounts,
  designated: Designated,
): Promise<void> {
  const payload = message.payload;
  const obligations = [
    { account: accounts.paygwBuffer.id, amount: BigInt(payload.paygwCents), type: "PAYGW" as const },
    { account: accounts.gstBuffer.id, amount: BigInt(payload.gstCents ?? 0), type: "GST" as const },
    { account: accounts.paygiBuffer.id, amount: BigInt(payload.paygiCents ?? 0), type: "PAYGI" as const },
  ];

  const postings = obligations
    .filter((entry) => entry.amount > 0n)
    .flatMap((entry) => [
      { accountId: accounts.bank.id, amountCents: -entry.amount },
      { accountId: entry.account, amountCents: entry.amount },
    ]);

  if (postings.length === 0) {
    return;
  }

  await ledgerWriter.write({
    orgId: message.orgId,
    eventId: message.id,
    dedupeId: message.dedupeId,
    type: "PAYROLL_HOLD",
    occurredAt: new Date(message.ts),
    source: message.source,
    description: `Payroll hold for ${payload.payrollId}`,
    postings,
  });

  if (payload.paygwCents > 0 && designated.paygw) {
    await recordDesignatedTransfer(designated.paygw, payload.paygwCents / 100, "PAYROLL_CAPTURE");
  }
  if ((payload.gstCents ?? 0) > 0 && designated.gst) {
    await recordDesignatedTransfer(designated.gst, (payload.gstCents ?? 0) / 100, "GST_CAPTURE");
  }
}

async function recordDesignatedTransfer(account: DesignatedAccount, amountDollars: number, source: string) {
  await applyDesignatedAccountTransfer(
    {
      prisma,
      auditLogger: (entry) => writeAuditLog(entry),
    },
    {
      orgId: account.orgId,
      accountId: account.id,
      amount: amountDollars,
      source,
      actorId: "demo-ingestion",
    },
  );
}

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
      gstCents: 450_00,
      paygiCents: 225_00,
    },
  };

  await bus.publish(subject, envelope);
}

async function ensureOrganization(orgId: string): Promise<void> {
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: "APGMS Demo Org" },
  });
}

export async function ensureBaselineAccounts(orgId: string) {
  const definitions = [
    { code: "1000", name: "BANK:Operating", type: AccountType.ASSET, subtype: AccountSubtype.BANK },
    { code: "2000", name: "LIABILITY:PAYGW_BUFFER", type: AccountType.LIABILITY, subtype: AccountSubtype.PAYGW_BUFFER },
    { code: "2100", name: "LIABILITY:GST_BUFFER", type: AccountType.LIABILITY, subtype: AccountSubtype.GST_BUFFER },
    { code: "2150", name: "LIABILITY:PAYGI_BUFFER", type: AccountType.LIABILITY, subtype: AccountSubtype.PAYGI_BUFFER },
    { code: "2200", name: "LIABILITY:CLEARING:BAS", type: AccountType.LIABILITY, subtype: AccountSubtype.CLEARING },
    { code: "9999", name: "SUSPENSE:RECON", type: AccountType.EXPENSE, subtype: AccountSubtype.SUSPENSE },
  ];

  const records = await Promise.all(
    definitions.map((entry) =>
      prisma.account.upsert({
        where: { orgId_code: { orgId, code: entry.code } },
        update: {},
        create: { orgId, ...entry },
      }),
    ),
  );

  return {
    bank: records[0],
    paygwBuffer: records[1],
    gstBuffer: records[2],
    paygiBuffer: records[3],
    clearing: records[4],
    suspense: records[5],
  };
}

async function ensureDesignatedAccounts(orgId: string) {
  const ensureAccount = async (type: "PAYGW" | "GST") => {
    const existing = await prisma.designatedAccount.findFirst({ where: { orgId, type } });
    if (existing) {
      return existing;
    }
    return prisma.designatedAccount.create({ data: { orgId, type } });
  };

  const [paygw, gst] = await Promise.all([ensureAccount("PAYGW"), ensureAccount("GST")]);
  return { paygw, gst };
}

async function getBufferBalances(accounts: BaselineAccounts) {
  const [paygw, gst] = await Promise.all([
    fetchAccountBalance(prisma, config.orgId, accounts.paygwBuffer.id),
    fetchAccountBalance(prisma, config.orgId, accounts.gstBuffer.id),
  ]);
  return {
    paygwCents: paygw.toString(),
    gstCents: gst.toString(),
    paygwDollars: Number(paygw) / 100,
    gstDollars: Number(gst) / 100,
  };
}

async function runPrecheck(accounts: BaselineAccounts, input: TransferInput) {
  const [paygw, gst, paygi] = await Promise.all([
    fetchAccountBalance(prisma, config.orgId, accounts.paygwBuffer.id),
    fetchAccountBalance(prisma, config.orgId, accounts.gstBuffer.id),
    fetchAccountBalance(prisma, config.orgId, accounts.paygiBuffer.id),
  ]);

  const shortfalls: Array<{ type: string; requiredCents: number; availableCents: string }> = [];
  if (BigInt(input.paygwCents) > paygw) {
    shortfalls.push({ type: "PAYGW", requiredCents: input.paygwCents, availableCents: paygw.toString() });
  }
  if (BigInt(input.gstCents) > gst) {
    shortfalls.push({ type: "GST", requiredCents: input.gstCents, availableCents: gst.toString() });
  }
  if (BigInt(input.paygiCents ?? 0) > paygi) {
    shortfalls.push({ type: "PAYGI", requiredCents: input.paygiCents ?? 0, availableCents: paygi.toString() });
  }

  return { ok: shortfalls.length === 0, shortfalls };
}

async function executeClearingTransfer(
  actorId: string,
  accounts: BaselineAccounts,
  designated: Designated,
  input: TransferInput,
) {
  const postings = buildClearingPostings(accounts, input);
  const journal = await ledgerWriter.write({
    orgId: config.orgId,
    eventId: uuidv7(),
    dedupeId: uuidv7(),
    type: "BAS_RELEASE",
    occurredAt: new Date(),
    source: "demo/transfer",
    description: "Demo BAS transfer",
    postings,
  });

  await Promise.all([
    input.paygwCents > 0
      ? recordDesignatedTransfer(designated.paygw, input.paygwCents / 100, "BAS_ESCROW")
      : Promise.resolve(),
    input.gstCents > 0
      ? recordDesignatedTransfer(designated.gst, input.gstCents / 100, "BAS_ESCROW")
      : Promise.resolve(),
  ]);

  return journal;
}

function buildClearingPostings(accounts: BaselineAccounts, input: TransferInput) {
  const postings: Array<{ accountId: string; amountCents: bigint }> = [];
  const pushPosting = (accountId: string, amount: bigint) => postings.push({ accountId, amountCents: amount });

  if (input.paygwCents > 0) {
    const amount = BigInt(input.paygwCents);
    pushPosting(accounts.paygwBuffer.id, -amount);
    pushPosting(accounts.clearing.id, amount);
  }
  if (input.gstCents > 0) {
    const amount = BigInt(input.gstCents);
    pushPosting(accounts.gstBuffer.id, -amount);
    pushPosting(accounts.clearing.id, amount);
  }
  if ((input.paygiCents ?? 0) > 0) {
    const amount = BigInt(input.paygiCents ?? 0);
    pushPosting(accounts.paygiBuffer.id, -amount);
    pushPosting(accounts.clearing.id, amount);
  }

  if (postings.length === 0) {
    throw new Error("transfer_requires_amount");
  }

  return postings;
}

async function forecastDemoObligations(orgId: string, accounts: BaselineAccounts) {
  const journals = await prisma.journal.findMany({
    where: { orgId, type: "PAYROLL_HOLD" },
    orderBy: { occurredAt: "desc" },
    take: MAX_FORECAST_POINTS,
    include: { postings: true },
  });

  const paygwSeries: number[] = [];
  const gstSeries: number[] = [];

  for (const journal of journals) {
    const paygwPosting = journal.postings.find((posting) => posting.accountId === accounts.paygwBuffer.id && posting.amountCents > 0n);
    const gstPosting = journal.postings.find((posting) => posting.accountId === accounts.gstBuffer.id && posting.amountCents > 0n);
    if (paygwPosting) {
      paygwSeries.push(Number(paygwPosting.amountCents) / 100);
    }
    if (gstPosting) {
      gstSeries.push(Number(gstPosting.amountCents) / 100);
    }
  }

  return {
    paygwForecast: exponentialMovingAverage(paygwSeries, EWMA_ALPHA),
    gstForecast: exponentialMovingAverage(gstSeries, EWMA_ALPHA),
    sampleSize: journals.length,
  };
}

async function generateReconciliationArtifact(accounts: BaselineAccounts) {
  return generateDemoReconciliationArtifact(prisma, config.orgId, {
    paygw: accounts.paygwBuffer.id,
    gst: accounts.gstBuffer.id,
    paygi: accounts.paygiBuffer.id,
    clearing: accounts.clearing.id,
  });
}

async function writeAuditLog(entry: {
  orgId: string;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId: entry.orgId },
    orderBy: { createdAt: "desc" },
  });
  const createdAt = new Date();
  const prevHash = previous?.hash ?? null;
  const metadataValue = (entry.metadata ?? {}) as Prisma.InputJsonValue;
  const hashPayload = JSON.stringify({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    metadata: metadataValue,
    createdAt: createdAt.toISOString(),
    prevHash,
  });
  const hash = createHash("sha256").update(hashPayload).digest("hex");
  await prisma.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      metadata: metadataValue,
      createdAt,
      hash,
      prevHash,
    },
  });
}

