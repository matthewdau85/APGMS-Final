import React, { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { Badge } from "../../shared/components/ui/badge";

import { getOrgId, setOrgId, getSetup, setSetup, type OrgSetup } from "../../shared/data/orgState";

const OBLIGATIONS = ["BAS", "PAYGW", "GST", "PAYGI", "SUPER"];

export function SetupWizard() {
  const existingOrgId = useMemo(() => getOrgId(), []);
  const existingSetup = useMemo(() => getSetup(), []);

  const [orgId, setOrgIdState] = useState(existingOrgId);
  const [jurisdiction, setJurisdiction] = useState(existingSetup.jurisdiction || "AU");
  const [defaultPeriod, setDefaultPeriod] = useState(existingSetup.defaultPeriod || "2024-Q4");
  const [enabled, setEnabled] = useState<string[]>(
    existingSetup.enabledObligations || ["BAS", "PAYGW", "SUPER"]
  );
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => {
    setEnabled((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    setSaved(false);
  };

  const save = () => {
    setOrgId(orgId);
    const setup: OrgSetup = {
      jurisdiction,
      enabledObligations: enabled,
      defaultPeriod,
    };
    setSetup(setup);
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Setup Wizard</h2>
          <p className="text-muted-foreground">Configure organization defaults and reporting scope.</p>
        </div>
        <Badge variant={saved ? "default" : "secondary"}>{saved ? "Saved" : "Not saved"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Organization and Scope
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            <label className="text-sm font-medium">Org ID (x-org-id)</label>
            <Input value={orgId} onChange={(e) => setOrgIdState(e.target.value)} placeholder="org_demo" />
            <div className="text-xs text-muted-foreground">
              Used to scope API requests and regulator summaries.
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Jurisdiction</label>
            <Input
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              placeholder="AU"
            />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Default Period</label>
            <Input
              value={defaultPeriod}
              onChange={(e) => setDefaultPeriod(e.target.value)}
              placeholder="2024-Q4"
            />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Enabled Obligations</label>
            <div className="flex flex-wrap gap-2">
              {OBLIGATIONS.map((o) => (
                <Button
                  key={o}
                  type="button"
                  variant={enabled.includes(o) ? "default" : "outline"}
                  onClick={() => toggle(o)}
                >
                  {o}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={save}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SetupWizard;
