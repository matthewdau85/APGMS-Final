import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BAS from "./pages/BAS";
import Alerts from "./pages/Alerts";
import Ledger from "./pages/Ledger";
import EvidencePacks from "./pages/EvidencePacks";
import Controls from "./pages/Controls";
import Incidents from "./pages/Incidents";
import Connectors from "./pages/Connectors";
import Settings from "./pages/Settings";
import AIAssistant from "./pages/AIAssistant";

import AdminArea from "./admin/AdminArea";

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Default */}
        <Route path="/" element={<Dashboard />} />

        {/* Core product */}
        <Route path="/bas" element={<BAS />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/evidence" element={<EvidencePacks />} />
        <Route path="/controls" element={<Controls />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/connectors" element={<Connectors />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai" element={<AIAssistant />} />

        {/* Admin only */}
        {user.role === "admin" ? (
          <Route path="/admin/*" element={<AdminArea />} />
        ) : null}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}
