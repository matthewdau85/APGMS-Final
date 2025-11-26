import type { PosTransaction } from "./pos.js";

export interface GstBatch {
  id: string;
  orgId: string;
  period: string;
  transactions: PosTransaction[];
}
