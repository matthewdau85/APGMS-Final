declare module "@prisma/client" {
  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
    [key: string]: any;
  }

  export type ModelFeedback = {
    id: string;
    predictionId: string;
    modelVersion: string;
    label: string;
    submittedBy: string;
    submittedRole: "FINANCE" | "REGULATOR";
    confidence: number | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}
