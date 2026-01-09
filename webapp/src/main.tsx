import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { AppMain } from "./AppMain";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppMain />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
