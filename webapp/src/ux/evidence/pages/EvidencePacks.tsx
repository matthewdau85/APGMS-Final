import React, { useEffect, useMemo, useState } from "react";
import { FileText, PackagePlus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Button } from "../../shared/components/ui/button";
import { Badge } from "../../shared/components/ui/badge";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { LoadingState } from "../../shared/components/LoadingState";
import { getToken } from "../../../auth";
import {
  addRecentEvidencePackId,
  getRecentEvidencePackIds,
  getSetup,
} from "../../shared/data/orgState";
import {
  createEvidenceArtifact,
  fetchEvidenceArtifacts,
  type EvidenceArtifact,
} from "../../shared/data/evidence";

export function EvidencePacks() {
  const setup = useMemo(() => getSetup(), []);
  const [recent, setRecent] = useState<string[]>(() => getRecentEvidencePackIds());
  const [artifacts, setArtifacts] = useState<EvidenceArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const token = getToken();

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
        const result = await fetchEvidenceArtifacts(token);
        if (!cancelled) {
          setArtifacts(result.artifacts ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load evidence packs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleGenerate = async () => {
    if (!token) {
      setAuthMissing(true);
      return;
    }
    setBusy(true);
    try {
      const period = setup.defaultPeriod || "2024-Q4";
      const res = await createEvidenceArtifact(token, {
        kind: "compliance-pack",
        payload: { period },
      });
      addRecentEvidencePackId(res.artifact.id);
      setRecent(getRecentEvidencePackIds());
      const refreshed = await fetchEvidenceArtifacts(token);
      setArtifacts(refreshed.artifacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate evidence pack.");
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
          {authMissing ? (
            <EmptyState
              icon={FileText}
              title="Sign in to load evidence"
              description="Connect a session token to generate and view evidence packs."
            />
          ) : loading ? (
            <LoadingState title="Loading evidence packs" lines={4} />
          ) : error ? (
            <ErrorState title="Unable to load evidence packs" description={error} />
          ) : (
            <>
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

              <div className="space-y-2">
                <div className="font-medium">Artifacts</div>
                {artifacts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No artifacts yet.</div>
                ) : (
                  <div className="space-y-2">
                    {artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                      >
                        <div>
                          <div className="font-medium">{artifact.kind}</div>
                          <div className="text-xs text-muted-foreground">
                            {artifact.createdAt ? new Date(artifact.createdAt).toLocaleString("en-AU") : "N/A"}
                          </div>
                        </div>
                        <Badge variant="secondary">{artifact.id}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EvidencePacks;
