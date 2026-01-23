type PayrollItem = { orgId: string; period: string; paygwCents: number };
type GstTransaction = { orgId: string; period: string; gstCents?: number; amountCents?: number };

export type InMemoryDb = {
  payrollItem: {
    create: (args: { data: PayrollItem }) => Promise<PayrollItem>;
    findMany: (args?: { where?: Partial<PayrollItem> }) => Promise<PayrollItem[]>;
  };
  gstTransaction: {
    create: (args: { data: GstTransaction }) => Promise<GstTransaction>;
    findMany: (args?: { where?: Partial<GstTransaction> }) => Promise<GstTransaction[]>;
  };
  ping: () => Promise<boolean>;
};

function matches<T extends object>(row: T, where: Partial<T> | undefined): boolean {
  if (!where) return true;
  for (const k of Object.keys(where) as (keyof T)[]) {
    if ((row as any)[k] !== (where as any)[k]) return false;
  }
  return true;
}

export function createInMemoryDb(): InMemoryDb {
  const payroll: PayrollItem[] = [];
  const gst: GstTransaction[] = [];

  return {
    payrollItem: {
      async create(args) {
        payroll.push(args.data);
        return args.data;
      },
      async findMany(args) {
        const where = args && args.where ? args.where : undefined;
        return payroll.filter((r) => matches(r, where));
      },
    },
    gstTransaction: {
      async create(args) {
        gst.push(args.data);
        return args.data;
      },
      async findMany(args) {
        const where = args && args.where ? args.where : undefined;
        return gst.filter((r) => matches(r, where));
      },
    },
    async ping() {
      return true;
    },
  };
}
