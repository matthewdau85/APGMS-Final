// webapp/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import FeedsPage from "./FeedsPage";
import AlertsPage from "./AlertsPage";
import BasPage from "./BasPage";
import CompliancePage from "./CompliancePage";
import SecurityPage from "./SecurityPage";
import ProtectedLayout from "./ProtectedLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* login */}
        <Route path="/" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/feeds" element={<FeedsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/bas" element={<BasPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/security" element={<SecurityPage />} />
        </Route>
        {/* catch-all */}
        <Route
          path="*"
          element={
            <div style={{ fontFamily: "system-ui", padding: 24 }}>
              Not found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
