import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import { protoApi, ProtoOverview } from "../../prototype/protoApi";
import { getSetup } from "../../prototype/protoState";
import { useProtoLive } from "../../prototype/useProtoLive";

function ModeBadge({ mode }: { mode: "live" | "simulated" }) {
  return (
    <Badge variant={mode === "live" ? "default" : "secondary"}>
      {mode === "live" ? "Live (Dev)" : "Simulated"}
    </Badge>
  );
}

export function Dashboard() {
  const setup = useMemo(() => getSetup(), []);
  const { checked } = useProtoLive();

  const [mode, setMode] = useState<"live" | "simulated">("simulated");
  const [overview, setOverview] = useState<ProtoOverview>({
    kpis: {
      complianceScore: 92,
      coverageRatio: 0.87,
      fundedThisPeriod: 12450,
      upcomingDueAmount: 8930,
    },
    recentActivity: [
      {
        id: "act-1",
        type: "reconciliation",
        message: "Bank feed ingested (Simulated)",
        timestamp: new Date().toISOString(),
        severity: "low",
      },
      {
        id: "act-2",
        type: "obligation",
        message: "BAS due in 9 days (Simulated)",
        timestamp: new Date().toISOString(),
        severity: "medium",
      },
    ],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const period = setup.defaultPeriod || "2024-Q4";
        const data = await protoApi.getOverview(period);
        if (!cancelled) {
          setOverview(data);
          setMode("live");
        }
      } catch {
        if (!cancelled) setMode("simulated");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setup.defaultPeriod]);

  const score = overview.kpis?.complianceScore ?? 0;
  const coverage = overview.kpis?.coverageRatio ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview of compliance posture and recent activity.</p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{score}%</div>
            <p className="text-xs text-muted-foreground">Target 95%+</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage Ratio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(coverage * 100)}%</div>
            <p className="text-xs text-muted-foreground">Reconciled / total transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funded This Period</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(overview.kpis?.fundedThisPeriod ?? 0).toLocaleString("en-AU", {
                style: "currency",
                currency: "AUD",
                maximumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Allocated to obligation buffers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Due</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(overview.kpis?.upcomingDueAmount ?? 0).toLocaleString("en-AU", {
                style: "currency",
                currency: "AUD",
                maximumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Next 14 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle>Recent Activity</CardTitle>
          <Badge variant="outline">{checked ? "Status checked" : "Checking..."}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {(overview.recentActivity ?? []).map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.message}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.timestamp).toLocaleString("en-AU")}
                </div>
              </div>
              <Badge variant="secondary">{a.type}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
