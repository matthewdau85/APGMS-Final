import React, { useState } from "react";
import { useCreatePlanMutation } from "../api";

export function PaymentPlanForm({ orgId, basCycleId }: { orgId: string; basCycleId: string }) {
  const [reason, setReason] = useState("Cash flow shortfall");
  const [weeklyAmount, setWeeklyAmount] = useState(1500);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [createPlan, { isLoading, isSuccess, isError }] = useCreatePlanMutation();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await createPlan({ orgId, basCycleId, reason, weeklyAmount, startDate, notes }).unwrap();
  }

  return (
    <form onSubmit={handleSubmit} className="payment-plan-form">
      <h3>Request structured payment plan</h3>
      <label>
        Reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required />
      </label>
      <label>
        Weekly amount (AUD)
        <input type="number" min={100} step={50} value={weeklyAmount} onChange={(event) => setWeeklyAmount(Number(event.target.value))} />
      </label>
      <label>
        Start date
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Submitting..." : "Submit request"}
      </button>
      {isSuccess && <p className="success">Plan logged with compliance</p>}
      {isError && <p className="error">Unable to submit plan. Try again.</p>}
    </form>
  );
}
