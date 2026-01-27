"use client";

import * as React from "react";
import { Download, FileCheck2, ShieldCheck } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useAppStore } from "@/app/store/appStore";
import type { EvidencePack } from "@/app/types";

export default function EvidencePacksPage() {
  const { evidencePacks, verifyEvidencePack } = useAppStore();
  const [tab, setTab] = React.useState<"all" | "verified" | "pending">("all");

  const filtered = React.useMemo(() => {
    if (tab === "verified") return evidencePacks.filter((p) => !!p.verifiedAt);
    if (tab === "pending") return evidencePacks.filter((p) => !p.verifiedAt);
    return evidencePacks;
  }, [evidencePacks, tab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence Packs</h1>
        <p className="text-sm text-muted-foreground">
          Build regulator-grade exports with immutable manifests and checksums.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((pack) => (
              <EvidencePackCard
                key={pack.id}
                pack={pack}
                onVerify={() => verifyEvidencePack(pack.id)}
              />
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card className="mt-4">
              <CardContent className="py-8 text-sm text-muted-foreground">
                No evidence packs in this view.
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EvidencePackCard({
  pack,
  onVerify,
}: {
  pack: EvidencePack;
  onVerify: () => void;
}) {
  const verified = !!pack.verifiedAt;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{pack.title}</CardTitle>
        <div className="text-xs text-muted-foreground">
          Period: {pack.periodLabel} • Created:{" "}
          {new Date(pack.createdAt).toLocaleString()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          {verified ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          ) : (
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">
            {verified ? "Verified" : "Not verified"}
          </span>
          {verified && pack.verifiedAt ? (
            <span className="text-xs text-muted-foreground">
              ({new Date(pack.verifiedAt).toLocaleString()})
            </span>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button
            className="flex-1"
            onClick={onVerify}
            disabled={verified}
            title={verified ? "Already verified" : "Verify manifest checksum"}
          >
            Verify
          </Button>
        </div>

        <div className="rounded-md border p-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Manifest</div>
          <div className="mt-1">
            Hash: <span className="font-mono">{pack.manifestHash}</span>
          </div>
          <div>
            Items: <span className="font-mono">{pack.itemCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
