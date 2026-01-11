import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../shared/components/ui/select";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { LoadingState } from "../../shared/components/LoadingState";
import { fetchObligationTotals } from "../../shared/data/obligations";
import { getOrgId, getSetup } from "../../shared/data/orgState";

type ObligationRow = {
  id: string;
  type: string;
  period: string;
  dueDate?: string | null;
  amount: number;
  status: "pending" | "settled";
};

export function Obligations() {
  const setup = useMemo(() => getSetup(), []);
  const [searchParams] = useSearchParams();

  const [obligations, setObligations] = useState<ObligationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const orgId = getOrgId();
        const [paygw, gst] = await Promise.all([
          fetchObligationTotals(orgId, "PAYGW"),
          fetchObligationTotals(orgId, "GST"),
        ]);

        const period = setup.defaultPeriod || "Current period";
        const rows: ObligationRow[] = [
          {
            id: `${orgId}-paygw`,
            type: "PAYGW",
            period,
            dueDate: null,
            amount: Number(paygw.pendingAmount ?? 0),
            status: Number(paygw.pendingAmount ?? 0) > 0 ? "pending" : "settled",
          },
          {
            id: `${orgId}-gst`,
            type: "GST",
            period,
            dueDate: null,
            amount: Number(gst.pendingAmount ?? 0),
            status: Number(gst.pendingAmount ?? 0) > 0 ? "pending" : "settled",
          },
        ];

        if (!cancelled) setObligations(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load obligations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setup.defaultPeriod, reloadKey]);

  useEffect(() => {
    setQuery(searchParams.get("query") ?? "");
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, typeFilter]);

  const filtered = obligations.filter((o) => {
    const matchesQuery =
      query.trim().length === 0 ||
      o.type.toLowerCase().includes(query.toLowerCase()) ||
      o.period.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const matchesType = typeFilter === "all" || o.type === typeFilter;
    return matchesQuery && matchesStatus && matchesType;
  });

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Obligations</h2>
          <p className="text-muted-foreground">Due dates, statuses, and amounts by obligation type.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Obligation List
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by type or period"
              className="w-56"
              aria-label="Search obligations"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="PAYGW">PAYGW</SelectItem>
                <SelectItem value="GST">GST</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filtered.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <LoadingState title="Loading obligations" lines={4} />
          ) : error ? (
            <ErrorState
              title="Unable to load obligations"
              description={error}
              onAction={() => setReloadKey((prev) => prev + 1)}
            />
          ) : pageItems.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No obligations found"
              description="Try adjusting your filters or search."
            />
          ) : (
            <>
              {pageItems.map((o) => {
                const isPending = o.status === "pending";
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                  >
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {o.type}
                        {isPending ? <AlertTriangle className="w-4 h-4" /> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Period: {o.period} {"\u2022"} Due:{" "}
                        {o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-AU") : "Not set"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">
                          {o.amount.toLocaleString("en-AU", {
                            style: "currency",
                            currency: "AUD",
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">{o.status}</div>
                      </div>
                      <Badge variant={isPending ? "destructive" : "secondary"}>{o.status}</Badge>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Obligations;
