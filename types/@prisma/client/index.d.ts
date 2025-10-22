declare module "@prisma/client" {
  export type JsonValue = unknown;
  export type JsonObject = Record<string, JsonValue>;
  export type JsonArray = JsonValue[];

  export namespace Prisma {
    export type JsonValue = unknown;
    export type JsonObject = Record<string, JsonValue>;
    export type JsonArray = JsonValue[];
  }

  interface PrismaNamespace {
    JsonValue: JsonValue;
    JsonObject: JsonObject;
    JsonArray: JsonArray;
  }

  export type Org = {
    id: string;
    name: string;
    createdAt: Date;
    deletedAt: Date | null;
    users?: User[];
    bankLines?: BankLine[];
  };

  export type User = {
    id: string;
    email: string;
    password: string | null;
    orgId: string;
    createdAt: Date;
    org?: Org | null;
  };

  export type BankLine = {
    id: string;
    orgId: string;
    date: Date;
    amount: number;
    payee: string;
    desc: string;
    createdAt: Date;
    idempotencyKey?: string | null;
  };

  export type PrismaClientOptions = {
    datasources?: {
      db?: {
        url?: string;
      };
    };
  };

  export class PrismaClient {
    constructor(options?: PrismaClientOptions);

    org: {
      findMany(args?: any): Promise<(Org & { users?: User[]; bankLines?: BankLine[] })[]>;
      findUnique(args: any): Promise<(Org & { users?: User[]; bankLines?: BankLine[] }) | null>;
      update(args: any): Promise<Org>;
    };

    orgTombstone: {
      findUnique(args: any): Promise<{ id: string } | null>;
      upsert(args: any): Promise<{ id: string }>;
      create(args: any): Promise<{ id: string }>;
    };

    user: {
      findUnique(args: any): Promise<User | null>;
      findMany(args?: any): Promise<User[]>;
      findFirst(args: any): Promise<User | null>;
      upsert?(args: any): Promise<User>;
      update(args: any): Promise<User>;
      delete(args: any): Promise<User>;
      deleteMany(args: any): Promise<{ count: number }>;
    };

    bankLine: {
      findMany(args?: any): Promise<BankLine[]>;
      create(args: any): Promise<BankLine>;
      upsert(args: any): Promise<BankLine>;
      deleteMany(args: any): Promise<{ count: number }>;
      count(args: any): Promise<number>;
    };

    adminAuditLog: {
      findFirst(args: any): Promise<{ hash: string } | null>;
      create(args: any): Promise<{ hash: string }>;
    };

    $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
    $queryRaw(...args: any[]): Promise<unknown>;
    $disconnect(): Promise<void>;
  }

  export const Prisma: PrismaNamespace;
  export type Prisma = PrismaNamespace;

  const _default: {
    PrismaClient: typeof PrismaClient;
  };

  export default _default;
}
