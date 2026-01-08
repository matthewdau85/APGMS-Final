import React from "react";

/**
 * Legacy admin-only console entrypoint.
 * Stubbed to keep existing imports/routes compiling.
 */
export function ProtoConsole() {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-lg font-semibold">Prototype Console</h1>
      <p className="text-sm text-muted-foreground">
        This console has been stubbed. Use the main application pages under src/app/.
      </p>
    </div>
  );
}
