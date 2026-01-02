import React, { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/auth";
import LoginPage from "./pages/LoginPage";
import AppMain from "./AppMain";
import { AdminArea } from "./admin/AdminArea";

function AppRouter() {
  const { user, isAdmin } = useAuth();
  const [mode, setMode] = useState<"main" | "admin">("main");

  if (!user) return <LoginPage />;

  if (mode === "admin") {
    // behind a button AND admin login
    if (!isAdmin) return <AppMain onEnterAdmin={() => { /* no-op */ }} />;
    return <AdminArea onExit={() => setMode("main")} />;
  }

  return <AppMain onEnterAdmin={() => setMode("admin")} />;
}

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
