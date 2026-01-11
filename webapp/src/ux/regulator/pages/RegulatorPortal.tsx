import React, { useEffect, useMemo, useState } from "react";
import { FileText, Scale } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Badge } from "../../shared/components/ui/badge";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { LoadingState } from "../../shared/components/LoadingState";
import { getRegulatorToken } from "../../../regulatorAuth";
import { getOrgId, getSetup } from "../../shared/data/orgState";
import {
  fetchRegulatorComplianceReport,
  fetchRegulatorEvidence,
  fetchRegulatorSummary,
  type RegulatorComplianceReport,
  type RegulatorSummary,
} from "../../shared/data/regulator";

export function RegulatorPortal() {
  const setup = useMemo(() => getSetup(), []);
  const [summary, setSummary] = useState<RegulatorSummary | null>(null);
  const [report, setReport] = useState<RegulatorComplianceReport | null>(null);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);
  const token = getRegulatorToken();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const orgId = getOrgId();
        const period = setup.defaultPeriod || "2024-Q4";
        const summaryResult = await fetchRegulatorSummary(orgId, period);

        let reportResult: RegulatorComplianceReport | null = null;
        let evidenceTotal = 0;
        if (token) {
          setAuthMissing(false);
          const [reportData, evidenceData] = await Promise.all([
            fetchRegulatorComplianceReport(token),
            fetchRegulatorEvidence(token),
          ]);
          reportResult = reportData;
          evidenceTotal = evidenceData.artifacts?.length ?? 0;
        } else {
          setAuthMissing(true);
        }

        if (!cancelled) {
          setSummary(summaryResult);
          setReport(reportResult);
          setEvidenceCount(evidenceTotal);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load regulator data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setup.defaultPeriod, token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Regulator Portal</h2>
          <p className="text-muted-foreground">
            Read-only view of compliance posture across organizations.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState title="Loading regulator summary" lines={4} />
      ) : error ? (
        <ErrorState title="Unable to load regulator portal" description={error} />
      ) : summary ? (
        <>
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
            <CardHeader className="flex items-center justify-between flex-row">
              <CardTitle>Evidence & Lodgments</CardTitle>
              <Badge variant="outline">{setup.defaultPeriod ?? "Current period"}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {authMissing ? (
                <EmptyState
                  icon={Scale}
                  title="Regulator session required"
                  description="Sign in to view compliance reports and evidence packs."
                />
              ) : report ? (
                <>
                  <div>
                    Last BAS status:{" "}
                    <span className="font-medium text-foreground">
                      {report.basHistory?.[0]?.status ?? "Unknown"}
                    </span>
                  </div>
                  <div>Open high-severity alerts: {report.alertsSummary.openHighSeverity}</div>
                  <div>Evidence artifacts on file: {evidenceCount}</div>
                </>
              ) : (
                <div>No compliance report available.</div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Scale}
          title="No regulator summary available"
          description="Configure an org ID and try again."
        />
      )}
    </div>
  );
}

export default RegulatorPortal;
