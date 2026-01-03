import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppMain from "./AppMain";
import { PrototypeApp } from "./prototype/PrototypeApp";

export default function App() {
  return (
    <Routes>
      <Route path="/proto/*" element={<PrototypeApp />} />
      <Route path="/*" element={<AppMain />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
