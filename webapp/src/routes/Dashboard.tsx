import React from "react";

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="mt-1 text-base font-semibold">Service running</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Next step</div>
          <div className="mt-1 text-base font-semibold">Wire routes to pages</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Controls</div>
          <div className="mt-1 text-base font-semibold">Add audit events</div>
        </div>
      </div>
    </div>
  );
}
