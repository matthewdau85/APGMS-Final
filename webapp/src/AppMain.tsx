import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

import { RequireAdmin } from "./auth/RequireAdmin";
import { ProtoConsole } from "./prototype/ProtoConsole";

export default function AppMain() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/proto/*"
        element={
          <RequireAdmin>
            <ProtoConsole />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
