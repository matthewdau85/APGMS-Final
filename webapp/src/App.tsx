// webapp/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* login */}
        <Route path="/" element={<LoginPage />} />
        {/* protected dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />
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
