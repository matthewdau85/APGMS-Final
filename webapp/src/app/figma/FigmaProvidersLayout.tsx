import React from "react";
import { Outlet } from "react-router-dom";

import { AuthProvider, useAuth } from "../../_figma/app/context/AuthContext";
import { AppProvider } from "../../_figma/app/context/AppContext";
import Layout from "../../_figma/app/components/Layout";

// Ensure the extracted Figma styling is present in the live app.
import "../../_figma/styles/index.css";

function EnsureFigmaRole(props: { children: React.ReactNode }) {
  const { role, setRole } = useAuth();

  React.useEffect(() => {
    // The extracted pages assume an authenticated role. When embedded into the
    // live app (which already gates access via ProtectedLayout), default to Admin.
    if (!role) setRole("Admin");
  }, [role, setRole]);

  return <>{props.children}</>;
}

export function FigmaProvidersLayout() {
  return (
    <AuthProvider>
      <EnsureFigmaRole>
        <AppProvider>
          <Layout>
            <Outlet />
          </Layout>
        </AppProvider>
      </EnsureFigmaRole>
    </AuthProvider>
  );
}
