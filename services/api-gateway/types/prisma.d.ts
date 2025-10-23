declare module "@prisma/client" {
  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
    [key: string]: any;
  }

  export type Org = any;
  export type User = any;
  export type BankLine = any;
  export type OrgTombstone = any;
  export type AuditLog = any;
}

