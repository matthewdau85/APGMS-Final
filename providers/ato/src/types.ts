import { z } from "zod";

export const machineCredentialSchema = z.object({
  keystorePath: z.string(),
  keystorePassword: z.string(),
  keystoreAlias: z.string(),
  softwareId: z.string(),
});

export type MachineCredential = z.infer<typeof machineCredentialSchema>;

export interface HttpConfig {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface SubmitResult {
  submissionId: string;
  statusEndpoint: string;
}

export interface SubmissionStatus {
  submissionId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  receivedAt: string;
  details?: string;
}

export interface BasStatement {
  documentId: string;
  lodgementPeriod: string;
  gstOnSales: number;
  gstOnPurchases: number;
  paygWithholding: number;
  paygInstalment: number;
}

export interface StpSubmissionPayload {
  specification: string;
  version: string;
  payload: Record<string, unknown>;
}
