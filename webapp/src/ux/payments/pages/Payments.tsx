import React, { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Badge } from "../../shared/components/ui/badge";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { LoadingState } from "../../shared/components/LoadingState";
import { getToken } from "../../../auth";
import { fetchPaymentPlans, type PaymentPlan } from "../../shared/data/payments";

export default function Payments() {
  const token = getToken();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        setAuthMissing(true);
        setLoading(false);
        return;
      }
      setAuthMissing(false);
      try {
        setLoading(true);
        setError(null);
        const result = await fetchPaymentPlans(token);
        if (!cancelled) setPlans(result.plans ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load payment plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground">
          Track payment plans, settlement status, and exceptions before lodgment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Payment Plans
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {authMissing ? (
            <EmptyState
              icon={Wallet}
              title="Sign in to load payment plans"
              description="Connect a session token to review payment requests."
            />
          ) : loading ? (
            <LoadingState title="Loading payment plans" lines={4} />
          ) : error ? (
            <ErrorState title="Unable to load payment plans" description={error} />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payment plans"
              description="Payment plan requests will appear once created."
            />
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border">
                <div>
                  <div className="font-medium">{plan.basCycleId}</div>
                  <div className="text-xs text-muted-foreground">
                    Requested {new Date(plan.requestedAt).toLocaleDateString("en-AU")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{plan.status.toLowerCase()}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
