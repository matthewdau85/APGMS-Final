// services/api-gateway/src/db/in-memory-db.ts

type Where = { orgId?: string; period?: string };
type FindManyArgs = { where?: Where; select?: Record<string, boolean> };
type DeleteManyArgs = { where?: Where };
type CreateArgs<T> = { data: T };

function pick<T extends Record<string, any>>(row: T, select?: Record<string, boolean>) {
  if (!select) return row;
  const out: Record<string, any> = {};
  for (const k of Object.keys(select)) {
    if (select[k]) out[k] = row[k];
  }
  return out;
}

function matches(where: Where | undefined, row: any) {
  if (!where) return true;
  if (where.orgId && row.orgId !== where.orgId) return false;
  if (where.period && row.period !== where.period) return false;
  return true;
}

export function createInMemoryDb(seed?: {
  payrollItems?: Array<{ orgId?: string; period?: string; paygwCents?: number }>;
  gstTransactions?: Array<{ orgId?: string; period?: string; gstCents?: number }>;
}) {
  const payrollItems: any[] = [...(seed?.payrollItems ?? [])];
  const gstTransactions: any[] = [...(seed?.gstTransactions ?? [])];

  return {
    payrollItem: {
      findMany: async (args: FindManyArgs = {}) => {
        const filtered = payrollItems.filter((r) => matches(args.where, r));
        return filtered.map((r) => pick(r, args.select));
      },

      deleteMany: async (args: DeleteManyArgs = {}) => {
        const before = payrollItems.length;
        for (let i = payrollItems.length - 1; i >= 0; i--) {
          if (matches(args.where, payrollItems[i])) payrollItems.splice(i, 1);
        }
        return { count: before - payrollItems.length };
      },

      create: async (args: CreateArgs<any>) => {
        const row = { ...args.data };
        payrollItems.push(row);
        return row;
      },
    },

    gstTransaction: {
      findMany: async (args: FindManyArgs = {}) => {
        const filtered = gstTransactions.filter((r) => matches(args.where, r));
        return filtered.map((r) => pick(r, args.select));
      },

      deleteMany: async (args: DeleteManyArgs = {}) => {
        const before = gstTransactions.length;
        for (let i = gstTransactions.length - 1; i >= 0; i--) {
          if (matches(args.where, gstTransactions[i])) gstTransactions.splice(i, 1);
        }
        return { count: before - gstTransactions.length };
      },

      create: async (args: CreateArgs<any>) => {
        const row = { ...args.data };
        gstTransactions.push(row);
        return row;
      },
    },
  };
}
