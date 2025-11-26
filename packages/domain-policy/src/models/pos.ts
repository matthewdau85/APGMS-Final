export interface PosTransaction {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  gstAmount: number;
  category?: string;
}
