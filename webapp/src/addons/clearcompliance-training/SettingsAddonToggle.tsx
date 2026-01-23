import React from "react";
import { Link } from "react-router-dom";
import {
  readClearComplianceTrainingEnabled,
  subscribeClearComplianceTrainingEnabled,
  writeClearComplianceTrainingEnabled,
} from "./storage";

export function ClearComplianceTrainingAddonToggle(): JSX.Element {
  const [enabled, setEnabled] = React.useState<boolean>(() => readClearComplianceTrainingEnabled());

  React.useEffect(() => {
    return subscribeClearComplianceTrainingEnabled(setEnabled);
  }, []);

  const onToggle = (next: boolean) => {
    setEnabled(next);
    writeClearComplianceTrainingEnabled(next);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-foreground">ClearCompliance Training</div>
          <div className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</div>
        </div>
        <div className="text-sm text-muted-foreground">
          Adds a Training page with ClearCompliance learning requirements and resources.
        </div>
        {enabled ? (
          <div className="pt-1">
            <Link to="/training" className="text-sm underline underline-offset-4">
              Open training
            </Link>
          </div>
        ) : null}
      </div>

      <label className="inline-flex cursor-pointer select-none items-center gap-2">
        <span className="sr-only">Enable ClearCompliance Training</span>
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>
    </div>
  );
}
