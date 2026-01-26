import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getSession } from "../auth/auth";

export default function ProtectedLayout() {
  const session = getSession();
  const location = useLocation();

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Outlet />
    </div>
  );
}
