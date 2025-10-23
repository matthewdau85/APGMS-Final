declare module "@prisma/client" {
  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
    [key: string]: any;
  }
}

