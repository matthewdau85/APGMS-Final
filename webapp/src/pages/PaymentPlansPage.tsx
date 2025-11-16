import React from "react";
import { getSessionUser } from "../auth";
import { ForecastChart, PaymentPlanForm, PaymentPlanTable } from "../features/paymentPlans";

export default function PaymentPlansPage() {
  const sessionUser = getSessionUser();
  const orgId = sessionUser?.orgId ?? "demo-org";
  const basCycleId = "current";

  return (
    <div className="page" style={{ padding: 24 }}>
      <h2>Payment plans</h2>
      <p>Track remediation requests, approvals, and predictive cash coverage.</p>
      <div className="payment-plans-grid">
        <div>
          <PaymentPlanForm orgId={orgId} basCycleId={basCycleId} />
          <PaymentPlanTable orgId={orgId} />
        </div>
        <div>
          <ForecastChart orgId={orgId} />
        </div>
      </div>
    </div>
  );
}
