import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { ErrorBoundary } from "./app/boot/ErrorBoundary";
import { ThemeInit } from "./app/boot/ThemeInit";

import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeInit />
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
