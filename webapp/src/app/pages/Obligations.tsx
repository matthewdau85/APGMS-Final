import React, { useEffect, useMemo, useState } from "react";
import { Calendar, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import { protoApi, ProtoObligation } from "../../prototype/protoApi";
import { getSetup } from "../../prototype/protoState";
import { useProtoLive } from "../../prototype/useProtoLive";

function ModeBadge({ mode }: { mode: "live" | "simulated" }) {
  return (
    <Badge variant={mode === "live" ? "default" : "secondary"}>
      {mode === "live" ? "Live (Dev)" : "Simulated"}
    </Badge>
  );
}

const fallbackObligations: ProtoObligation[] = [
  {
    id: "obl-1",
    type: "BAS",
    period: "2024-Q4",
    dueDate: new Date(Date.now() + 9 * 86400000).toISOString(),
    amount: 8930,
    status: "upcoming",
  },
  {
    id: "obl-2",
    type: "PAYGW",
    period: "2024-12",
    dueDate: new Date(Date.now() + 4 * 86400000).toISOString(),
    amount: 4120,
    status: "in_progress",
  },
  {
    id: "obl-3",
    type: "SUPER",
    period: "2024-Q4",
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    amount: 2750,
    status: "overdue",
  },
];

export function Obligations() {
  const setup = useMemo(() => getSetup(), []);
  useProtoLive();

  const [mode, setMode] = useState<"live" | "simulated">("simulated");
  const [obligations, setObligations] = useState<ProtoObligation[]>(fallbackObligations);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const period = setup.defaultPeriod || "2024-Q4";
        const data = await protoApi.getObligations(period);
        if (!cancelled) {
          setObligations(data);
          setMode("live");
        }
      } catch {
        if (!cancelled) {
          setObligations(fallbackObligations);
          setMode("simulated");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setup.defaultPeriod]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Obligations</h2>
          <p className="text-muted-foreground">Due dates, statuses, and amounts by obligation type.</p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Obligation List
          </CardTitle>
          <Badge variant="outline">{obligations.length} items</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {obligations.map((o) => {
            const isOverdue = o.status === "overdue";
            return (
              <div
                key={o.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border"
              >
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {o.type}
                    {isOverdue ? <AlertTriangle className="w-4 h-4" /> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Period: {o.period} {"\u2022"} Due:{" "}
                    {new Date(o.dueDate).toLocaleDateString("en-AU")}
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
                  <Badge variant={isOverdue ? "destructive" : "secondary"}>{o.status}</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default Obligations;
