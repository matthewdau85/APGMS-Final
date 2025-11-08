export class PrismaClient {
  $use(): void {}
  $queryRaw(): Promise<unknown> {
    return Promise.resolve(1);
  }
  $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export class PrismaClientKnownRequestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("prisma");
    this.code = code;
  }
}

export const Prisma = {
  JsonNull: Symbol.for("JsonNull"),
  PrismaClientKnownRequestError,
  Decimal: class {},
};

export class Alert {}
export class BasCycle {}
export class DesignatedAccount {}
export class DesignatedTransfer {}
export class PaymentPlanRequest {}
export class MonitoringSnapshot {}
