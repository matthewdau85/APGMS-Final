import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { hasSetup } from "../ux/shared/data/orgState";

export function RequireConsoleAuth(props: { children: React.ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  const needsSetup = !hasSetup();
  if (needsSetup && loc.pathname !== "/setup") {
    return <Navigate to="/setup" replace state={{ from: loc.pathname }} />;
  }

  return <>{props.children}</>;
}
