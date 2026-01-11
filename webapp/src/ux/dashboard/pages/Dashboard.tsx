import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Badge } from "../../shared/components/ui/badge";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { LoadingState } from "../../shared/components/LoadingState";
import { fetchComplianceReport, type ComplianceReport } from "../../shared/data/dashboard";
import { getOrgId, getSetup } from "../../shared/data/orgState";

export function Dashboard() {
  const setup = useMemo(() => getSetup(), []);
  const [reports, setReports] = useState<ComplianceReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const orgId = getOrgId();
        const [paygw, gst] = await Promise.all([
          fetchComplianceReport(orgId, "PAYGW"),
          fetchComplianceReport(orgId, "GST"),
        ]);
        if (!cancelled) setReports([paygw, gst]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setup.defaultPeriod, reloadKey]);

  const pendingTotal = reports
    ? reports.reduce((sum, report) => sum + Number(report.pendingObligations || 0), 0)
    : 0;
  const discrepancies = reports ? reports.flatMap((report) => report.discrepancies ?? []) : [];
  const paymentPlans = reports
    ? Array.from(
        new Map(
          reports
            .flatMap((report) => report.paymentPlans ?? [])
            .map((plan) => [plan.id, plan])
        ).values()
      )
    : [];
  const anomalyScore = reports?.[0]?.anomaly?.score ?? null;

  const recentActivity = discrepancies
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview of compliance posture and recent activity.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState title="Loading compliance signals" lines={4} />
      ) : error ? (
        <ErrorState
          title="Unable to load dashboard"
          description={error}
          onAction={() => setReloadKey((prev) => prev + 1)}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Obligations</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {pendingTotal.toLocaleString("en-AU", {
                    style: "currency",
                    currency: "AUD",
                    maximumFractionDigits: 0,
                  })}
                </div>
                <p className="text-xs text-muted-foreground">PAYGW + GST totals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Discrepancies</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{discrepancies.length}</div>
                <p className="text-xs text-muted-foreground">Awaiting resolution</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Anomaly Score</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {anomalyScore == null ? "N/A" : Math.round(anomalyScore * 100)}
                </div>
                <p className="text-xs text-muted-foreground">0 = stable, 100 = critical</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payment Plans</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paymentPlans.length}</div>
                <p className="text-xs text-muted-foreground">Active requests</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>Recent Activity</CardTitle>
              <Badge variant="outline">{setup.defaultPeriod ?? "Current period"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No recent activity"
                  description="Discrepancies and integration events will appear here."
                />
              ) : (
                recentActivity.map((a) => (
                  <div key={a.eventId} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("en-AU")}
                      </div>
                    </div>
                    <Badge variant="secondary">discrepancy</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default Dashboard;
