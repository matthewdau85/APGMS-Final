import React, { useMemo, useState } from "react";
import PrototypeShell, { type NavId } from "./PrototypeShell";
import { PrototypeProvider } from "./store";

import DashboardPage from "./pages/DashboardPage";
import ObligationsPage from "./pages/ObligationsPage";
import LedgerPage from "./pages/LedgerPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import EvidencePackPage from "./pages/EvidencePackPage";
import ControlsPoliciesPage from "./pages/ControlsPoliciesPage";
import IncidentsPage from "./pages/IncidentsPage";
import SettingsPage from "./pages/SettingsPage";
import RegulatorPortalPage from "./pages/RegulatorPortalPage";

export function PrototypeApp(props: { onExit: () => void }) {
  const nav = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      { id: "obligations" as const, label: "Obligations" },
      { id: "ledger" as const, label: "Ledger" },
      { id: "reconciliation" as const, label: "Reconciliation" },
      { id: "evidence" as const, label: "Evidence Pack" },
      { id: "controls" as const, label: "Controls & Policies" },
      { id: "incidents" as const, label: "Incidents" },
      { id: "settings" as const, label: "Settings" },
      { id: "regulator" as const, label: "Regulator Portal (RO)" },
    ],
    []
  );

  const [current, setCurrent] = useState<NavId>("dashboard");

  return (
    <PrototypeProvider>
      <PrototypeShell nav={nav} current={current} onNavigate={setCurrent} onExit={props.onExit}>
        {current === "dashboard" && <DashboardPage />}
        {current === "obligations" && <ObligationsPage />}
        {current === "ledger" && <LedgerPage />}
        {current === "reconciliation" && <ReconciliationPage />}
        {current === "evidence" && <EvidencePackPage />}
        {current === "controls" && <ControlsPoliciesPage />}
        {current === "incidents" && <IncidentsPage />}
        {current === "settings" && <SettingsPage />}
        {current === "regulator" && <RegulatorPortalPage />}
      </PrototypeShell>
    </PrototypeProvider>
  );
}
