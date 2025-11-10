// webapp/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import FeedsPage from "./FeedsPage";
import AlertsPage from "./AlertsPage";
import BasPage from "./BasPage";
import CompliancePage from "./CompliancePage";
import SecurityPage from "./SecurityPage";
import ProtectedLayout from "./ProtectedLayout";
import RegulatorLoginPage from "./RegulatorLoginPage";
import RegulatorLayout from "./RegulatorLayout";
import RegulatorOverviewPage from "./RegulatorOverviewPage";
import RegulatorEvidencePage from "./RegulatorEvidencePage";
import RegulatorMonitoringPage from "./RegulatorMonitoringPage";
import { appConfig } from "./config";
import {
  AdminPrototypeGuard,
  AdminPrototypeLayout,
  OverviewPage as AdminPrototypeOverviewPage,
  OnboardingFlowPage,
  RiskReviewFlowPage,
} from "./admin-prototype";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* login */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/regulator" element={<RegulatorLoginPage />} />
        <Route path="/regulator/portal" element={<RegulatorLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<RegulatorOverviewPage />} />
          <Route path="evidence" element={<RegulatorEvidencePage />} />
          <Route path="monitoring" element={<RegulatorMonitoringPage />} />
        </Route>
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/feeds" element={<FeedsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/bas" element={<BasPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/security" element={<SecurityPage />} />
        </Route>
        {appConfig.featureFlags.adminPrototype && (
          <Route
            path="/admin-prototype"
            element={
              <AdminPrototypeGuard>
                <AdminPrototypeLayout />
              </AdminPrototypeGuard>
            }
          >
            <Route index element={<AdminPrototypeOverviewPage />} />
            <Route path="onboarding" element={<OnboardingFlowPage />} />
            <Route path="risk-review" element={<RiskReviewFlowPage />} />
          </Route>
        )}
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
