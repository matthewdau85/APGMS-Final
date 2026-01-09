import React, { useEffect, useState } from "react";
import { Scale, FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import { protoApi } from "../../prototype/protoApi";

function ModeBadge({ mode }: { mode: "live" | "simulated" }) {
  return (
    <Badge variant={mode === "live" ? "default" : "secondary"}>
      {mode === "live" ? "Live (Dev)" : "Simulated"}
    </Badge>
  );
}

type Summary = {
  totalOrganizations: number;
  compliantOrganizations: number;
  overdueObligations: number;
  criticalIncidents: number;
};

const fallback: Summary = {
  totalOrganizations: 150,
  compliantOrganizations: 142,
  overdueObligations: 8,
  criticalIncidents: 2,
};

export function RegulatorPortal() {
  const [mode, setMode] = useState<"live" | "simulated">("simulated");
  const [summary, setSummary] = useState<Summary>(fallback);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await protoApi.getRegulatorSummary();
        if (!cancelled) {
          setSummary({
            totalOrganizations: data.totalOrganizations ?? fallback.totalOrganizations,
            compliantOrganizations: data.compliantOrganizations ?? fallback.compliantOrganizations,
            overdueObligations: data.overdueObligations ?? fallback.overdueObligations,
            criticalIncidents: data.criticalIncidents ?? fallback.criticalIncidents,
          });
          setMode("live");
        }
      } catch {
        if (!cancelled) {
          setSummary(fallback);
          setMode("simulated");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Regulator Portal</h2>
          <p className="text-muted-foreground">
            Read-only prototype view of compliance posture across organizations.
          </p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
            <Scale className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrganizations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliant Orgs</CardTitle>
            <Badge variant="outline">ok</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.compliantOrganizations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Obligations</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overdueObligations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Incidents</CardTitle>
            <Badge variant="destructive">risk</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.criticalIncidents}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            This page is investor-safe: it labels Live (Dev) vs Simulated and does not imply real regulator connectivity.
          </div>
          <div>
            Replace with real aggregation + evidence-pack listing once the backend endpoints are de-stubbed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegulatorPortal;
