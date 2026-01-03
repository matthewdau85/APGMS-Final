import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import { AdminArea } from "./admin/AdminArea";

import { RequireAdmin } from "./auth/RequireAdmin";
import { PrototypeApp } from "./prototype/PrototypeApp";

export default function AppMain() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin" element={<AdminArea />} />

      {/* Admin-only prototype console */}
      <Route
        path="/proto/*"
        element={
          <RequireAdmin>
            <PrototypeApp />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
