import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import { ProtoConsole } from "./prototype/ProtoConsole";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/proto/*" element={<ProtoConsole />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
