import React from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { OnboardingWizard } from "./routes/OnboardingWizard";
import { Dashboard } from "./routes/Dashboard";
import { Layout } from "./routes/Layout";

// Temporary auth/org stub – replace with real context when ready
function useAuth() {
  const stored = window.localStorage.getItem("apgms_org_id");
  return { orgId: stored ?? null, isAuthenticated: true };
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <RedirectToDashboardOrOnboarding />,
      },
      {
        path: "onboarding",
        element: <OnboardingGuard />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      // ...other routes...
    ],
  },
]);

function RedirectToDashboardOrOnboarding() {
  const { orgId } = useAuth();
  if (!orgId) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}

function OnboardingGuard() {
  const { orgId } = useAuth();
  if (orgId) return <Navigate to="/dashboard" replace />;
  return <OnboardingWizard />;
}

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
