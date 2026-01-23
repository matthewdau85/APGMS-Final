import React from "react";
import { Link } from "react-router-dom";
import { readClearComplianceTrainingEnabled, subscribeClearComplianceTrainingEnabled } from "./storage";

export function ClearComplianceTrainingPage(): JSX.Element {
  const [enabled, setEnabled] = React.useState<boolean>(() => readClearComplianceTrainingEnabled());

  React.useEffect(() => {
    return subscribeClearComplianceTrainingEnabled(setEnabled);
  }, []);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-foreground">Training</h1>
        <p className="text-sm text-muted-foreground">
          The ClearCompliance Training add-on is currently disabled for this organization.
        </p>
        <div>
          <Link to="/settings" className="text-sm underline underline-offset-4">
            Go to Settings to enable
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">ClearCompliance Training</h1>
        <p className="text-sm text-muted-foreground">
          Prototype training hub. Next step is wiring your curriculum/catalog and progress tracking.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Included modules (placeholder)</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>ATO Ready Program overview</li>
            <li>Tax Buffer System setup (one-way account, allocation, automation)</li>
            <li>Obligations workflow: detect -&gt; reconcile -&gt; evidence pack</li>
            <li>Controls and policies baseline</li>
            <li>Incident handling and regulator portal hygiene</li>
          </ul>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Manage add-ons in{" "}
        <Link to="/settings" className="underline underline-offset-4">
          Settings
        </Link>
        .
      </div>
    </div>
  );
}
