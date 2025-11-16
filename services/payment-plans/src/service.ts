type PrismaClient = {
  paymentPlanRequest: {
    create(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    findUnique(args: any): Promise<any | null>;
    update(args: any): Promise<any>;
  };
};

export type CreatePaymentPlanInput = {
  orgId: string;
  basCycleId: string;
  reason: string;
  weeklyAmount: number;
  startDate: string;
  notes?: string;
  installments?: number;
};

export type PaymentPlanRecord = Awaited<ReturnType<typeof mapPlan>>;

type PaymentPlanModel = {
  id: string;
  orgId: string;
  basCycleId: string;
  requestedAt: Date;
  reason: string;
  status: string;
  detailsJson: Record<string, unknown> | null;
  resolvedAt: Date | null;
};

function buildInstallments(
  amount: number,
  weeklyAmount: number,
  startDate: string,
  weeks: number,
) {
  const schedule: Array<{ week: number; dueDate: string; amount: number }> = [];
  const start = new Date(startDate);
  const normalized = Number.isFinite(weeks) && weeks > 0 ? weeks : Math.ceil(amount / weeklyAmount);
  const totalWeeks = Math.max(1, normalized);
  let remaining = amount;
  for (let i = 0; i < totalWeeks; i += 1) {
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + i * 7);
    const installment = i === totalWeeks - 1 ? remaining : Math.min(weeklyAmount, remaining);
    schedule.push({ week: i + 1, dueDate: dueDate.toISOString(), amount: Number(installment.toFixed(2)) });
    remaining = Math.max(0, Number((remaining - installment).toFixed(2)));
  }
  return schedule;
}

function mapPlan(plan: PaymentPlanModel) {
  return {
    id: plan.id,
    orgId: plan.orgId,
    basCycleId: plan.basCycleId,
    requestedAt: plan.requestedAt.toISOString(),
    reason: plan.reason,
    status: plan.status,
    resolvedAt: plan.resolvedAt ? plan.resolvedAt.toISOString() : null,
    details: plan.detailsJson ?? {},
  };
}

export async function createPaymentPlan(
  prisma: PrismaClient,
  input: CreatePaymentPlanInput,
  basAmount: { paygwShortfall: number; gstShortfall: number } = { paygwShortfall: 0, gstShortfall: 0 },
) {
  const totalShortfall = Number((basAmount.paygwShortfall + basAmount.gstShortfall).toFixed(2));
  const installments = buildInstallments(totalShortfall, input.weeklyAmount, input.startDate, input.installments ?? 12);
  const details = {
    weeklyAmount: input.weeklyAmount,
    startDate: input.startDate,
    notes: input.notes,
    installments,
    totalShortfall,
  };
  const created = await prisma.paymentPlanRequest.create({
    data: {
      orgId: input.orgId,
      basCycleId: input.basCycleId,
      reason: input.reason,
      detailsJson: details,
    },
  });
  return mapPlan({ ...created, detailsJson: details, resolvedAt: created.resolvedAt ?? null } as PaymentPlanModel);
}

export async function listPaymentPlanHistory(prisma: PrismaClient, orgId: string, limit = 25) {
  const plans = (await prisma.paymentPlanRequest.findMany({
    where: { orgId },
    orderBy: { requestedAt: "desc" },
    take: limit,
  })) as unknown as PaymentPlanModel[];
  return plans.map((plan) => mapPlan(plan));
}

export async function getPaymentPlan(prisma: PrismaClient, planId: string) {
  const plan = await prisma.paymentPlanRequest.findUnique({ where: { id: planId } });
  return plan ? mapPlan(plan as unknown as PaymentPlanModel) : null;
}

export async function updatePaymentPlanStatus(
  prisma: PrismaClient,
  planId: string,
  status: "APPROVED" | "REJECTED" | "CANCELLED",
  metadata?: Record<string, unknown>,
) {
  const updated = await prisma.paymentPlanRequest.update({
    where: { id: planId },
    data: { status, detailsJson: metadata ?? undefined, resolvedAt: new Date() },
  });
  return mapPlan(updated as unknown as PaymentPlanModel);
}
