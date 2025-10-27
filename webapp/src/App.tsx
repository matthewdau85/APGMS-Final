// services/webapp/src/App.tsx
import { useState, useEffect } from "react";
import { LoginPage } from "./LoginPage";
import { DashboardPage } from "./DashboardPage";

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  // load token from localStorage once
  useEffect(() => {
    const t = localStorage.getItem("apgmsToken");
    if (t) setToken(t);
  }, []);

  if (!token) {
    return (
      <LoginPage
        onLogin={(t) => {
          setToken(t);
        }}
      />
    );
  }

  return (
    <DashboardPage
      token={token}
      onLogout={() => {
        setToken(null);
      }}
    />
  );
}
