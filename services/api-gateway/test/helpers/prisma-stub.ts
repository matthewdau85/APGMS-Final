import { randomUUID } from "node:crypto";
import type { BankLine, Org, PrismaClient, User } from "@prisma/client";

export type OrgState = Org & { deletedAt: Date | null };

export type State = {
  orgs: OrgState[];
  users: User[];
  bankLines: BankLine[];
  tombstones: Array<{ id: string; orgId: string; payload: unknown; createdAt: Date }>;
};

type TransactionCallback<T> = (tx: PrismaLike) => Promise<T>;

type UserSelect = { [K in keyof User]?: boolean };
type BankLineSelect = { [K in keyof BankLine]?: boolean };

type UserFindManyArgs = {
  where?: { orgId?: string };
  orderBy?: { createdAt?: "asc" | "desc" };
  select?: UserSelect;
};

type UserFindUniqueArgs = {
  where: { id: string };
  select?: UserSelect;
};

type BankLineFindManyArgs = {
  where?: { orgId?: string };
  orderBy?: { date?: "asc" | "desc" };
  take?: number;
  select?: BankLineSelect;
};

type BankLineCreateArgs = {
  data: {
    orgId: string;
    date: Date;
    amount: unknown;
    payee: string;
    desc: string;
    idempotencyKey?: string | null;
  };
  select?: BankLineSelect;
};

type BankLineUpsertArgs = {
  where: { orgId_idempotencyKey: { orgId: string; idempotencyKey: string } };
  create: BankLineCreateArgs["data"];
  update: Partial<BankLine>;
  select?: BankLineSelect;
};

type BankLineDeleteManyArgs = { where?: { orgId?: string } };

type UserDeleteManyArgs = { where?: { orgId?: string } };

type OrgFindUniqueArgs = {
  where: { id: string };
  include?: { users?: boolean; lines?: boolean };
};

type OrgUpdateArgs = { where: { id: string }; data: Partial<OrgState> };

type OrgTombstoneCreateArgs = {
  data: { id?: string; orgId: string; payload: unknown; createdAt?: Date };
};

export type PrismaLike = Pick<
  PrismaClient,
  "$transaction"
> & {
  org: {
    findUnique: (args: OrgFindUniqueArgs) => Promise<OrgState | (OrgState & { users: User[]; lines: BankLine[] }) | null>;
    update: (args: OrgUpdateArgs) => Promise<OrgState>;
  };
  user: {
    findMany: (args: UserFindManyArgs) => Promise<Array<Partial<User>>>;
    findUnique: (args: UserFindUniqueArgs) => Promise<Partial<User> | null>;
    deleteMany: (args: UserDeleteManyArgs) => Promise<{ count: number }>;
  };
  bankLine: {
    findMany: (args: BankLineFindManyArgs) => Promise<Array<Partial<BankLine>>>;
    create: (args: BankLineCreateArgs) => Promise<Partial<BankLine>>;
    upsert: (args: BankLineUpsertArgs) => Promise<Partial<BankLine>>;
    deleteMany: (args: BankLineDeleteManyArgs) => Promise<{ count: number }>;
  };
  orgTombstone: {
    create: (args: OrgTombstoneCreateArgs) => Promise<{ id: string; orgId: string; payload: unknown; createdAt: Date }>;
  };
};

export type Stub = { client: PrismaLike; state: State };

export function createPrismaStub(initial?: Partial<State>): Stub {
  const state: State = {
    orgs: initial?.orgs ?? [],
    users: initial?.users ?? [],
    bankLines: initial?.bankLines ?? [],
    tombstones: initial?.tombstones ?? [],
  };

  const client: PrismaLike = {
    org: {
      findUnique: async ({ where, include }) => {
        const org = state.orgs.find((o) => o.id === where.id);
        if (!org) return null;
        if (include?.users || include?.lines) {
          return {
            ...org,
            users: include?.users ? state.users.filter((user) => user.orgId === org.id) : [],
            lines: include?.lines ? state.bankLines.filter((line) => line.orgId === org.id) : [],
          } as OrgState & { users: User[]; lines: BankLine[] };
        }
        return { ...org };
      },
      update: async ({ where, data }) => {
        const org = state.orgs.find((o) => o.id === where.id);
        if (!org) throw new Error("Org not found");
        Object.assign(org, data);
        return { ...org };
      },
    },
    user: {
      findMany: async ({ where, orderBy, select } = {}) => {
        let users = [...state.users];
        if (where?.orgId) {
          users = users.filter((user) => user.orgId === where.orgId);
        }
        if (orderBy?.createdAt === "desc") {
          users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (select) {
          return users.map((user) => pick(user, select));
        }
        return users.map((user) => ({ ...user }));
      },
      findUnique: async ({ where, select }) => {
        const user = state.users.find((u) => u.id === where.id);
        if (!user) return null;
        if (select) {
          return pick(user, select);
        }
        return { ...user };
      },
      deleteMany: async ({ where } = {}) => {
        const initialLength = state.users.length;
        state.users = state.users.filter((user) => (where?.orgId ? user.orgId !== where.orgId : true));
        return { count: initialLength - state.users.length };
      },
    },
    bankLine: {
      findMany: async ({ where, orderBy, take, select } = {}) => {
        let lines = [...state.bankLines];
        if (where?.orgId) {
          lines = lines.filter((line) => line.orgId === where.orgId);
        }
        if (orderBy?.date === "desc") {
          lines.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (typeof take === "number") {
          lines = lines.slice(0, take);
        }
        if (select) {
          return lines.map((line) => pick(line, select));
        }
        return lines.map((line) => ({ ...line }));
      },
      create: async ({ data, select }) => {
        const created: BankLine = {
          id: randomUUID(),
          orgId: data.orgId,
          date: data.date,
          amount: data.amount as any,
          payee: data.payee,
          desc: data.desc,
          createdAt: new Date(),
          idempotencyKey: data.idempotencyKey ?? null,
        };
        state.bankLines.push(created);
        if (select) {
          return pick(created, select);
        }
        return { ...created };
      },
      upsert: async ({ where, create, update, select }) => {
        const existing = state.bankLines.find(
          (line) =>
            line.orgId === where.orgId_idempotencyKey.orgId &&
            line.idempotencyKey === where.orgId_idempotencyKey.idempotencyKey
        );
        if (existing) {
          Object.assign(existing, update);
          if (select) {
            return pick(existing, select);
          }
          return { ...existing };
        }
        const created: BankLine = {
          id: randomUUID(),
          orgId: create.orgId,
          date: create.date,
          amount: create.amount as any,
          payee: create.payee,
          desc: create.desc,
          createdAt: new Date(),
          idempotencyKey: create.idempotencyKey ?? null,
        };
        state.bankLines.push(created);
        if (select) {
          return pick(created, select);
        }
        return { ...created };
      },
      deleteMany: async ({ where } = {}) => {
        const initialLength = state.bankLines.length;
        state.bankLines = state.bankLines.filter((line) => (where?.orgId ? line.orgId !== where.orgId : true));
        return { count: initialLength - state.bankLines.length };
      },
    },
    orgTombstone: {
      create: async ({ data }) => {
        const record = {
          id: data.id ?? randomUUID(),
          orgId: data.orgId,
          payload: data.payload,
          createdAt: data.createdAt ?? new Date(),
        };
        state.tombstones.push(record);
        return record;
      },
    },
    $transaction: async <T>(callback: TransactionCallback<T>) => {
      return callback(client);
    },
  } as unknown as PrismaLike;

  return { client, state };
}

export function seedOrgWithData(state: State, ids: { orgId: string; userId: string; lineId: string }) {
  const createdAt = new Date("2024-01-01T00:00:00Z");
  state.orgs.push({
    id: ids.orgId,
    name: "Example Org",
    createdAt,
    deletedAt: null,
  } as OrgState);
  state.users.push({
    id: ids.userId,
    email: "someone@example.com",
    password: "hashed-password",
    orgId: ids.orgId,
    createdAt,
  } as User);
  state.bankLines.push({
    id: ids.lineId,
    orgId: ids.orgId,
    date: new Date("2024-02-02T00:00:00Z"),
    amount: 1200 as any,
    payee: "Vendor",
    desc: "Invoice",
    createdAt,
    idempotencyKey: null,
  } as BankLine);
}

export function pick<T extends Record<string, unknown>>(value: T, select: Record<string, boolean>): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, include] of Object.entries(select)) {
    if (include && key in (value as any)) {
      result[key] = (value as any)[key];
    }
  }
  return result as Partial<T>;
}
