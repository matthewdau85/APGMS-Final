import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SetupWizard from "./pages/SetupWizard";
import RegulatorPortal from "./pages/RegulatorPortal";
import { RequireAdmin } from "./auth/RequireAdmin";
import { AdminArea } from "./admin/AdminArea";
import { PrototypeApp } from "./prototype/PrototypeApp";

export function AppMain() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/setup" element={<SetupWizard />} />
      <Route path="/regulator" element={<RegulatorPortal />} />

      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <AdminArea />
          </RequireAdmin>
        }
      />

      <Route
        path="/proto/*"
        element={
          <RequireAdmin>
            <PrototypeApp />
          </RequireAdmin>
        }
      />

      {/* Keep prototype stable: any unknown route goes home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppMain;
