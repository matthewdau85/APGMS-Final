import type { DesignatedReconciliationSummary, FeatureVector } from "./types.js";

export function deriveFeatureVector(summary: DesignatedReconciliationSummary): FeatureVector {
  const totals = summary.movementsLast24h.reduce(
    (acc, movement) => {
      const normalizedType = movement.type.toUpperCase();
      if (normalizedType.includes("PAYGW")) {
        acc.paygwBalance += movement.balance;
        acc.paygwInflow += movement.inflow24h;
        acc.paygwTransfers += movement.transferCount24h;
      }
      if (normalizedType.includes("GST")) {
        acc.gstBalance += movement.balance;
        acc.gstInflow += movement.inflow24h;
        acc.gstTransfers += movement.transferCount24h;
      }
      acc.totalBalance += movement.balance;
      acc.totalInflow += movement.inflow24h;
      acc.totalTransfers += movement.transferCount24h;
      return acc;
    },
    {
      totalBalance: 0,
      totalInflow: 0,
      totalTransfers: 0,
      paygwBalance: 0,
      paygwInflow: 0,
      paygwTransfers: 0,
      gstBalance: 0,
      gstInflow: 0,
      gstTransfers: 0,
    },
  );

  const avgTransferSize = totals.totalTransfers > 0 ? totals.totalInflow / totals.totalTransfers : 0;
  const paygwBalanceShare = totals.totalBalance > 0 ? totals.paygwBalance / totals.totalBalance : 0;
  const gstBalanceShare = totals.totalBalance > 0 ? totals.gstBalance / totals.totalBalance : 0;

  return {
    total_balance: Number(totals.totalBalance.toFixed(2)),
    total_inflow_24h: Number(totals.totalInflow.toFixed(2)),
    total_transfers_24h: totals.totalTransfers,
    paygw_balance: Number(totals.paygwBalance.toFixed(2)),
    paygw_inflow_24h: Number(totals.paygwInflow.toFixed(2)),
    paygw_transfers_24h: totals.paygwTransfers,
    gst_balance: Number(totals.gstBalance.toFixed(2)),
    gst_inflow_24h: Number(totals.gstInflow.toFixed(2)),
    gst_transfers_24h: totals.gstTransfers,
    avg_transfer_size_24h: Number(avgTransferSize.toFixed(2)),
    paygw_balance_share: Number(paygwBalanceShare.toFixed(4)),
    gst_balance_share: Number(gstBalanceShare.toFixed(4)),
  } satisfies FeatureVector;
}
