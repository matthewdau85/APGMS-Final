import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../ux/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ux/shared/components/ui/card";
import { Label } from "../ux/shared/components/ui/label";
import { Switch } from "../ux/shared/components/ui/switch";

const LS_KEY = "apgms:addons:clearcompliance-training:enabled";

type OrgSettings = {
  clearComplianceTrainingEnabled?: boolean;
  addons?: {
    clearComplianceTraining?: {
      enabled?: boolean;
    };
  };
};

function readLocalEnabled(): boolean | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) === true;
  } catch {
    return null;
  }
}

function writeLocalEnabled(enabled: boolean) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(enabled));
  } catch {
    // ignore
  }
}

function pickEnabledFromSettings(settings: OrgSettings | null | undefined): boolean | null {
  if (!settings) return null;

  if (settings.addons?.clearComplianceTraining?.enabled === true) return true;
  if (settings.addons?.clearComplianceTraining?.enabled === false) return false;

  if (settings.clearComplianceTrainingEnabled === true) return true;
  if (settings.clearComplianceTrainingEnabled === false) return false;

  return null;
}

async function fetchOrgSettings(): Promise<OrgSettings | null> {
  try {
    const res = await fetch("/org/settings", {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "include",
    });

    if (!res.ok) return null;
    const data = (await res.json()) as OrgSettings;
    return data ?? null;
  } catch {
    return null;
  }
}

async function persistEnabled(enabled: boolean): Promise<boolean> {
  // Best-effort persistence. Falls back to localStorage if the API is not available.
  const payload: Partial<OrgSettings> = {
    clearComplianceTrainingEnabled: enabled,
    addons: { clearComplianceTraining: { enabled } },
  };

  // Try PATCH first (preferred for settings updates).
  try {
    const res = await fetch("/org/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.ok) return true;
  } catch {
    // ignore
  }

  // Fallback to PUT.
  try {
    const res = await fetch("/org/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.ok) return true;
  } catch {
    // ignore
  }

  return false;
}

function useClearComplianceTrainingEnabled() {
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const settings = await fetchOrgSettings();
      const fromServer = pickEnabledFromSettings(settings);

      const fromLocal = readLocalEnabled();

      const initial =
        fromServer !== null ? fromServer : fromLocal !== null ? fromLocal : false;

      if (!cancelled) {
        setEnabled(initial);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = React.useCallback(async (next: boolean) => {
    setEnabled(next);
    writeLocalEnabled(next);

    setSaving(true);
    setError(null);

    const ok = await persistEnabled(next);

    if (!ok) {
      // This is non-fatal. The toggle still works locally.
      setError("Saved locally only (org settings API not available).");
    }

    setSaving(false);
  }, []);

  return { enabled, loading, saving, error, setEnabled: update };
}

export function ClearComplianceTrainingAddonToggle() {
  const { enabled, loading, saving, error, setEnabled } = useClearComplianceTrainingEnabled();

  return (
    <div className="flex items-start justify-between gap-6 rounded-md border p-4">
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-base">ClearCompliance training</Label>
          <p className="text-sm text-muted-foreground">
            Adds a Training area to help users learn the ClearCompliance workflow and complete modules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/training">Open training</Link>
          </Button>

          {loading ? (
            <span className="text-xs text-muted-foreground">Loading...</span>
          ) : saving ? (
            <span className="text-xs text-muted-foreground">Saving...</span>
          ) : enabled ? (
            <span className="text-xs text-muted-foreground">Enabled</span>
          ) : (
            <span className="text-xs text-muted-foreground">Disabled</span>
          )}
        </div>

        {error ? <p className="text-xs text-amber-600">{error}</p> : null}
      </div>

      <div className="pt-1">
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(Boolean(v))}
          disabled={loading || saving}
        />
      </div>
    </div>
  );
}

export function ClearComplianceTrainingPage() {
  const { enabled, loading } = useClearComplianceTrainingEnabled();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">ClearCompliance training</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Training modules to help you operate ClearCompliance consistently and auditably.
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link to="/settings">Settings</Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading</CardTitle>
            <CardDescription>Fetching your organisation settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Please wait.</p>
          </CardContent>
        </Card>
      ) : !enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Training is disabled</CardTitle>
            <CardDescription>
              Enable the ClearCompliance training add-on in Settings to access modules here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link to="/settings">Go to Settings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Module library</CardTitle>
              <CardDescription>
                This is the minimal scaffolding for the training add-on. Next step: wire in your
                module content, videos, and progress tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-5 text-sm text-foreground space-y-1">
                <li>Intro: What ClearCompliance is and what it manages</li>
                <li>Obligations: Creating, validating, and resolving blockers</li>
                <li>Ledger: Recording, reconciling, and evidence pack generation</li>
                <li>Controls: Policy mapping, approvals, and audit trails</li>
                <li>Incidents: Breach handling, reporting, and remediations</li>
              </ul>

              <div className="pt-2">
                <Button variant="outline" asChild>
                  <Link to="/settings">Manage add-ons</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
