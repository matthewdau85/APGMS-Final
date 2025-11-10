import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSessionUser, getToken } from "../auth";
import { appConfig } from "../config";

const ADMIN_ROLES = new Set(["admin", "superadmin", "root", "platform-admin"]);

type Props = {
  children: React.ReactNode;
};

export default function AdminPrototypeGuard({ children }: Props) {
  const location = useLocation();
  const token = getToken();
  const user = getSessionUser();

  if (!appConfig.featureFlags.adminPrototype) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!token || !user) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const normalizedRole = user.role?.toLowerCase() ?? "";

  if (!ADMIN_ROLES.has(normalizedRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
