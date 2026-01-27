"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CreditCard,
  FileText,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/app/components/ui/chart";
import { useAppStore } from "@/app/store/appStore";

export default function Dashboard() {
  const {
    organization,
    currentPeriod,
    obligations,
    alerts,
    evidencePacks,
    connectors,
  } = useAppStore();

  const dueSoon = React.useMemo(() => {
    const now = new Date();
    const in14 = new Date(now);
    in14.setDate(in14.getDate() + 14);
    return obligations.filter((o) => {
      const due = new Date(o.dueDate);
      return due >= now && due <= in14 && o.status !== "lodged";
    });
  }, [obligations]);

  const riskScore = React.useMemo(() => {
    // Simple heuristic demo: alerts + overdue obligations + connector errors
    const overdue = obligations.filter((o) => o.status === "overdue").length;
    const activeAlerts = alerts.filter((a) => !a.dismissed).length;
    const connectorIssues = connectors.filter(
      (c) => c.status === "error" || c.status === "disconnected"
    ).length;

    const raw = overdue * 25 + activeAlerts * 10 + connectorIssues * 15;
    return Math.max(0, Math.min(100, raw));
  }, [alerts, connectors, obligations]);

  const pieData = React.useMemo(() => {
    const byStatus = obligations.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  }, [obligations]);

  const pieConfig = React.useMemo(
    () => ({
      lodged: { label: "Lodged", color: "hsl(var(--chart-1))" },
      due: { label: "Due", color: "hsl(var(--chart-2))" },
      overdue: { label: "Overdue", color: "hsl(var(--chart-3))" },
      draft: { label: "Draft", color: "hsl(var(--chart-4))" },
      reconciled: { label: "Reconciled", color: "hsl(var(--chart-5))" },
    }),
    []
  );

  const evidenceVerified = React.useMemo(() => {
    const verified = evidencePacks.filter((e) => !!e.verifiedAt).length;
    return { verified, total: evidencePacks.length };
  }, [evidencePacks]);

  const reserveBalance = organization?.funds?.reserveBalance ?? 0;
  const taxBalance = organization?.funds?.taxBalance ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {organization?.name || "Org"} • {currentPeriod?.label || "Current Period"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Evidence pack
          </Button>
          <Button>
            Review blockers
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Risk score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {riskScore >= 60 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              )}
              <div className="text-2xl font-semibold tabular-nums">{riskScore}</div>
              <div className="text-sm text-muted-foreground">/ 100</div>
            </div>
            <Progress value={riskScore} />
            <p className="text-xs text-muted-foreground">
              Heuristic demo score: alerts + overdue obligations + connector issues.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Due soon (14 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold tabular-nums">{dueSoon.length}</div>
            <p className="text-xs text-muted-foreground">
              Obligations due between now and the next 14 days.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evidence verified</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              <div className="text-2xl font-semibold tabular-nums">
                {evidenceVerified.verified}
              </div>
              <div className="text-sm text-muted-foreground">
                / {evidenceVerified.total}
              </div>
            </div>
            <Progress
              value={
                evidenceVerified.total
                  ? (evidenceVerified.verified / evidenceVerified.total) * 100
                  : 0
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Obligations by status</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ChartContainer config={pieConfig}>
              <RechartsPrimitive.PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PieWithLabels data={pieData} />
                <ChartLegend content={<ChartLegendContent />} />
              </RechartsPrimitive.PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BalanceRow
              icon={<PiggyBank className="h-4 w-4" />}
              label="Reserve"
              amount={reserveBalance}
            />
            <BalanceRow
              icon={<Building2 className="h-4 w-4" />}
              label="Tax (one-way)"
              amount={taxBalance}
            />
            <BalanceRow
              icon={<CreditCard className="h-4 w-4" />}
              label="Connected accounts"
              amount={connectors.filter((c) => c.status === "connected").length}
              isCount
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BalanceRow({
  icon,
  label,
  amount,
  isCount,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  isCount?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        <div className="text-sm">{label}</div>
      </div>
      <div className={cn("font-medium tabular-nums", isCount && "text-sm")}>
        {isCount ? amount : amount.toLocaleString(undefined, { style: "currency", currency: "AUD" })}
      </div>
    </div>
  );
}

function PieWithLabels({ data }: { data: { name: string; value: number }[] }) {
  return (
    <RechartsPrimitive.Pie
      data={data}
      dataKey="value"
      nameKey="name"
      innerRadius={55}
      outerRadius={90}
      strokeWidth={2}
      labelLine={false}
      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const p = percent ?? 0;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = (cx as number) + radius * Math.cos(-midAngle * RADIAN);
        const y = (cy as number) + radius * Math.sin(-midAngle * RADIAN);

        return p > 0.05 ? (
          <text
            x={x}
            y={y}
            fill="currentColor"
            textAnchor={x > (cx as number) ? "start" : "end"}
            dominantBaseline="central"
            className="text-[10px] opacity-80"
          >
            {(p * 100).toFixed(0)}%
          </text>
        ) : null;
      }}
    />
  );
}
