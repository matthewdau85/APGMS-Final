import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import ProtectedLayout from "../layouts/ProtectedLayout";
import AdminArea from "../admin/AdminArea";
import FeedsPage from "../pages/FeedsPage";

import { FigmaProvidersLayout } from "./figma/FigmaProvidersLayout";

// Figma-derived (restored compliance UX pages)
import { Dashboard } from "../_figma/app/pages/Dashboard";
import { BAS } from "../_figma/app/pages/BAS";
import { Alerts } from "../_figma/app/pages/Alerts";
import { Ledger } from "../_figma/app/pages/Ledger";
import { EvidencePacks } from "../_figma/app/pages/EvidencePacks";
import { Controls } from "../_figma/app/pages/Controls";
import { Incidents } from "../_figma/app/pages/Incidents";
import { Connectors } from "../_figma/app/pages/Connectors";
import { Settings } from "../_figma/app/pages/Settings";
import { AIAssistant } from "../_figma/app/pages/AIAssistant";
import { Reconciliation } from "../_figma/app/pages/Reconciliation";
import { Obligations } from "../_figma/app/pages/Obligations";
import { ObligationDetail } from "../_figma/app/pages/ObligationDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        {/* Admin (still behind auth) */}
        <Route path="/admin/*" element={<AdminArea />} />

        {/* Restored compliance UX (Figma-derived shell + pages) */}
        <Route element={<FigmaProvidersLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/bas" element={<BAS />} />

          <Route path="/alerts" element={<Alerts />} />
          <Route path="/ledger" element={<Ledger />} />

          <Route path="/obligations" element={<Obligations />} />
          <Route path="/obligations/:id" element={<ObligationDetail />} />

          <Route path="/reconciliation" element={<Reconciliation />} />

          <Route path="/evidence" element={<EvidencePacks />} />
          <Route path="/evidence-packs" element={<EvidencePacks />} />

          <Route path="/controls" element={<Controls />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/connectors" element={<Connectors />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai" element={<AIAssistant />} />

          {/* Keep existing feed view available (wrapped in the same shell) */}
          <Route path="/feeds" element={<FeedsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
