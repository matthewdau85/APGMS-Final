import React from "react";
import { createBrowserRouter } from "react-router-dom";

// FIX: these modules export default (not named exports)
import Dashboard from "./routes/Dashboard";
import Layout from "./routes/Layout";

// Keep your existing imports/routes here if you already have them.
// The following are common in this repo based on your earlier a11y routes.
import RegulatorLoginPage from "./RegulatorLoginPage";

// If this file exists in your repo, keep it. If not, remove this import and route.
// (Your a11y test references "/bank-lines", so it likely exists.)
import BankLines from "./routes/BankLines";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "bank-lines", element: <BankLines /> },
    ],
  },
  {
    path: "/regulator/login",
    element: <RegulatorLoginPage />,
  },
]);

export default router;
