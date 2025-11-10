import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type PrismaFeedbackRole = "FINANCE" | "REGULATOR";

export type StoredFeedback = {
  id: string;
  predictionId: string;
  modelVersion: string;
  label: string;
  submittedBy: string;
  submittedRole: PrismaFeedbackRole;
  confidence: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};
