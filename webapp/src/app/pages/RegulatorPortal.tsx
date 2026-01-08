import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

type EvidencePackStub = {
  id: string;
  org: string;
  period: string;
  createdAt: string; // ISO
  schemaVersion: string;
  sha256: string;
  status: "ready" | "pending" | "failed";
};

const packs: EvidencePackStub[] = [
  {
    id: "pack_2025Q4_0003",
    org: "Acme Corporation",
    period: "Q4 2025",
    createdAt: "2026-01-06T03:12:00.000Z",
    schemaVersion: "1.0.0",
    sha256: "9f2f9a6c2c5c3b4a1b8f8b3a0d4d1b7a0a5d6c2e8a1b2c3d4e5f6a7b8c9d0e1f",
    status: "ready",
  },
  {
    id: "pack_2025Q4_0002",
    org: "Acme Corporation",
    period: "Q4 2025",
    createdAt: "2026-01-05T09:41:00.000Z",
    schemaVersion: "1.0.0",
    sha256: "2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809",
    status: "ready",
  },
  {
    id: "pack_2025Q4_0001",
    org: "Demo Company",
    period: "Q4 2025",
    createdAt: "2026-01-04T01:08:00.000Z",
    schemaVersion: "1.0.0",
    sha256: "a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2",
    status: "pending",
  },
];

function statusBadgeVariant(s: EvidencePackStub["status"]) {
  if (s === "ready") return "default";
  if (s === "pending") return "secondary";
  return "destructive";
}

export default function RegulatorPortal() {
  // Stubbed summary (replace with service-layer calls later)
  const summary = {
    obligationsDue: 2,
    blockedItems: 1,
    openIncidents: 1,
    latestPack: packs[0]?.id ?? "none",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Read-only banner */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Regulator Portal</CardTitle>
            <Badge variant="secondary">Read-only</Badge>
          </div>
          <CardDescription>
            This view mimics the production regulator experience. All data shown here is stubbed,
            but the information architecture and permissions boundary should match production.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Tip: In production, this page must not expose any mutation endpoints. Treat read-only
            as a service boundary, not a UI toggle.
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Compliance summary tiles */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obligations due</CardTitle>
            <CardDescription>Next 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.obligationsDue}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blocked items</CardTitle>
            <CardDescription>Funding or data gaps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.blockedItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open incidents</CardTitle>
            <CardDescription>Active remediation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.openIncidents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest pack</CardTitle>
            <CardDescription>Most recent build</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium break-all">{summary.latestPack}</div>
          </CardContent>
        </Card>
      </div>

      {/* Evidence pack list */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Packs</CardTitle>
          <CardDescription>
            Stub list. In production, each pack links to a signed manifest, checksum list, and artifacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {packs.map((p) => (
            <div
              key={p.id}
              className="rounded-md border p-4 bg-card flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{p.id}</div>
                  <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {p.org} | {p.period} | {new Date(p.createdAt).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground break-all">
                  schema {p.schemaVersion} | sha256 {p.sha256}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Placeholders: wire these to your evidence-pack download flow later */}
                <Button variant="outline" disabled>
                  View manifest
                </Button>
                <Button variant="outline" disabled>
                  Download
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
