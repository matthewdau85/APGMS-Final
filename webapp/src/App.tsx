// webapp/src/app/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import BasPage from "../pages/BasPage";
import CompliancePage from "../pages/CompliancePage";
import AlertsPage from "../pages/AlertsPage";
import FeedsPage from "../pages/FeedsPage";

import ProtectedLayout from "../layouts/ProtectedLayout";
import { AdminArea } from "../admin/AdminArea";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Operator-only tools (guarded by x-admin-token in the UI + server). */}
      <Route path="/admin/*" element={<AdminArea />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<BasPage />} />
        <Route path="/bas" element={<BasPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/feeds" element={<FeedsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
