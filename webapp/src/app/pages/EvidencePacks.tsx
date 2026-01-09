import React, { useMemo, useState } from "react";
import { FileText, PackagePlus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

import { protoApi } from "../../prototype/protoApi";
import {
  addRecentEvidencePackId,
  getRecentEvidencePackIds,
  getSetup,
} from "../../prototype/protoState";

function ModeBadge({ mode }: { mode: "live" | "simulated" }) {
  return (
    <Badge variant={mode === "live" ? "default" : "secondary"}>
      {mode === "live" ? "Live (Dev)" : "Simulated"}
    </Badge>
  );
}

export function EvidencePacks() {
  const setup = useMemo(() => getSetup(), []);
  const [mode, setMode] = useState<"live" | "simulated">("simulated");
  const [recent, setRecent] = useState<string[]>(() => getRecentEvidencePackIds());
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const obligationIds = ["obl-1", "obl-2"];
      const period = setup.defaultPeriod || "2024-Q4";

      const res = await protoApi.generateEvidencePack({ obligationIds, period });
      addRecentEvidencePackId(res.packId);
      setRecent(getRecentEvidencePackIds());
      setMode("live");
    } catch {
      const packId = `SIM-${Date.now()}`;
      addRecentEvidencePackId(packId);
      setRecent(getRecentEvidencePackIds());
      setMode("simulated");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Evidence Packs</h2>
          <p className="text-muted-foreground">
            Generate and view compliance evidence packs (manifest + artifacts).
          </p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Evidence Pack
          </CardTitle>
          <Button onClick={handleGenerate} disabled={busy} className="gap-2">
            <PackagePlus className="w-4 h-4" />
            {busy ? "Generating..." : "Generate"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Prototype behavior: always labels output as Live (Dev) or Simulated.
          </div>

          <div className="space-y-2">
            <div className="font-medium">Recent Pack IDs</div>
            {recent.length === 0 ? (
              <div className="text-sm text-muted-foreground">None yet.</div>
            ) : (
              <div className="space-y-2">
                {recent.map((id) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="font-mono text-sm">{id}</div>
                    <Badge variant="outline">generated</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EvidencePacks;
