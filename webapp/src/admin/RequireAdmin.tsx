import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (user.role !== "admin") return <Navigate to="/" />;
  return <>{children}</>;
}
