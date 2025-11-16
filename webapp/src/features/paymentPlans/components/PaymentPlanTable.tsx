import React from "react";
import { useListPlansQuery, useUpdatePlanStatusMutation } from "../api";

export function PaymentPlanTable({ orgId }: { orgId: string }) {
  const { data: plans, isLoading, isError } = useListPlansQuery({ orgId });
  const [updateStatus] = useUpdatePlanStatusMutation();

  if (isLoading) {
    return <div className="info">Loading plan history…</div>;
  }

  if (isError) {
    return <div className="error">Unable to load payment plans</div>;
  }

  if (!plans || plans.length === 0) {
    return <div className="info">No payment plans logged yet.</div>;
  }

  return (
    <table className="plan-table">
      <thead>
        <tr>
          <th>Requested</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Weekly amount</th>
          <th>Start date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {plans.map((plan) => {
          const details = plan.details ?? {};
          const weeklyAmount = details.weeklyAmount as number | undefined;
          const startDate = details.startDate as string | undefined;
          return (
            <tr key={plan.id}>
              <td>{new Date(plan.requestedAt).toLocaleString()}</td>
              <td>{plan.reason}</td>
              <td>{plan.status}</td>
              <td>{weeklyAmount ? `$${weeklyAmount.toLocaleString()}` : "—"}</td>
              <td>{startDate ? new Date(startDate).toLocaleDateString() : "—"}</td>
              <td>
                <button onClick={() => updateStatus({ id: plan.id, status: "APPROVED" })}>Approve</button>
                <button onClick={() => updateStatus({ id: plan.id, status: "REJECTED" })}>Reject</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
