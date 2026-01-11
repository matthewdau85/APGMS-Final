import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export type RequireAdminProps = {
  children?: React.ReactNode;
};

export function RequireAdmin({ children }: RequireAdminProps) {
  const { isAdmin } = useAuth();
  const loc = useLocation();

  if (!isAdmin) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  // If used as a wrapper component:
  if (children) return <>{children}</>;

  // If used as a route element:
  return <Outlet />;
}

export default RequireAdmin;
