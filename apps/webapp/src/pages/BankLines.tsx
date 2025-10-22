import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LineStatus = "Active" | "Pending" | "Monitoring";

type BankLine = {
  bank: string;
  limit: string;
  utilization: string;
  status: LineStatus;
  updated: string;
  notes: string;
};

const bankLines: BankLine[] = [
  {
    bank: "Commonwealth Bank",
    limit: "$1.2B",
    utilization: "64%",
    status: "Active",
    updated: "Today 10:24",
    notes: "Term sheet expansion approved for Helios storage facility."
  },
  {
    bank: "Northwind Credit Union",
    limit: "$820M",
    utilization: "71%",
    status: "Monitoring",
    updated: "Yesterday",
    notes: "Utilization trending upward ahead of portfolio rebalance."
  },
  {
    bank: "First Harbor Partners",
    limit: "$640M",
    utilization: "48%",
    status: "Pending",
    updated: "2 days ago",
    notes: "Awaiting revised covenants from legal after counterparty feedback."
  }
];

const statusLabels: Record<LineStatus, string> = {
  Active: "Operational",
  Pending: "Requires approval",
  Monitoring: "Watch closely"
};

const statusVariant: Record<LineStatus, "success" | "warning" | "secondary"> = {
  Active: "success",
  Pending: "warning",
  Monitoring: "secondary"
};

function StatusBadge({ status }: { status: LineStatus }) {
  return (
    <Badge
      variant={statusVariant[status]}
      className={cn(
        "flex flex-col items-start gap-1 px-3 py-2 text-[0.75rem] font-semibold uppercase tracking-wide",
        status === "Monitoring" && "bg-primary-soft text-primary"
      )}
    >
      <span>{status}</span>
      <span className="text-[0.65rem] font-normal leading-none opacity-80">
        {statusLabels[status]}
      </span>
    </Badge>
  );
}

export default function BankLinesPage() {
  const totals = useMemo(() => {
    const totalLimit = bankLines.reduce((sum, line) => {
      const numeric = Number(line.limit.replace(/[$MB]/g, ""));
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
    const averageUtilization =
      bankLines.reduce((sum, line) => sum + Number.parseInt(line.utilization, 10), 0) /
      bankLines.length;

    return {
      totalLimit: `$${(totalLimit / 1000).toFixed(1)}B`,
      averageUtilization: `${Math.round(averageUtilization)}%`
    };
  }, []);

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            Bank line visibility
          </Badge>
          <h1 className="text-4xl tracking-tight">Stabilize multi-bank exposure</h1>
          <p className="max-w-3xl text-base text-muted">
            Stay ahead of liquidity requirements with a consolidated view of commitments, live
            utilization, and watchlist signals across your institutional lenders.
          </p>
        </div>
        <Button size="lg" className="self-start bg-gradient-to-r from-primary to-success text-primary-foreground shadow-md">
          Export exposure report
        </Button>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total committed capital</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">{totals.totalLimit}</p>
            <p className="text-sm text-muted">Sum of committed lines across tracked lenders.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">{totals.averageUtilization}</p>
            <p className="text-sm text-muted">Weighted exposure across all active mandates.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Exposure by lender</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-lg border border-border/70 p-0">
          <div className="relative w-full overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Breakdown of bank line utilization and statuses</caption>
              <thead className="bg-surface-muted">
                <tr className="text-left text-muted">
                  <th scope="col" className="px-6 py-4 font-medium">
                    Lender
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium">
                    Limit
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium">
                    Utilization
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {bankLines.map((line) => (
                  <tr key={line.bank} className="border-t border-border/60">
                    <th scope="row" className="px-6 py-5 text-left text-base font-semibold">
                      {line.bank}
                    </th>
                    <td className="px-6 py-5">{line.limit}</td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-2">
                        <span className="text-base font-semibold">{line.utilization}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                            style={{ width: line.utilization }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={line.status} />
                    </td>
                    <td className="px-6 py-5 text-muted">{line.updated}</td>
                    <td className="px-6 py-5 text-muted">{line.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
