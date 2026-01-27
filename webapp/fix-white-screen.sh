#!/usr/bin/env bash
set -eu

ROOT="src"
APP="$ROOT/app"
PAGES="$ROOT/pages"
LAYOUTS="$ROOT/layouts"

echo "==> Fixing APGMS white-screen issues"

mkdir -p "$APP" "$PAGES" "$LAYOUTS"

# ---------------------------
# main.tsx (SINGLE ROUTER)
# ---------------------------
cat > "$ROOT/main.tsx" <<'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
EOF

# ---------------------------
# App.tsx (ROUTES)
# ---------------------------
cat > "$APP/App.tsx" <<'EOF'
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import BasPage from "../pages/BasPage";
import CompliancePage from "../pages/CompliancePage";
import AlertsPage from "../pages/AlertsPage";
import FeedsPage from "../pages/FeedsPage";

import ProtectedLayout from "../layouts/ProtectedLayout";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<BasPage />} />
        <Route path="/bas" element={<BasPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/feeds" element={<FeedsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
EOF

# ---------------------------
# ProtectedLayout.tsx
# ---------------------------
cat > "$LAYOUTS/ProtectedLayout.tsx" <<'EOF'
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
EOF

# ---------------------------
# LoginPage.tsx
# ---------------------------
cat > "$PAGES/LoginPage.tsx" <<'EOF'
import { useLocation, useNavigate } from "react-router-dom";
import { setSession } from "../auth/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;

  function login() {
    setSession({ token: "dev", user: { name: "Dev" } });
    navigate(location.state?.from ?? "/", { replace: true });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <button onClick={login}>Login</button>
    </main>
  );
}
EOF

# ---------------------------
# Pages (NO return null)
# ---------------------------
cat > "$PAGES/BasPage.tsx" <<'EOF'
export default function BasPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>BAS</h1>
      <p>BAS dashboard loaded.</p>
    </main>
  );
}
EOF

cat > "$PAGES/CompliancePage.tsx" <<'EOF'
export default function CompliancePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Compliance</h1>
      <p>Compliance dashboard loaded.</p>
    </main>
  );
}
EOF

cat > "$PAGES/AlertsPage.tsx" <<'EOF'
export default function AlertsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Alerts</h1>
      <p>Alerts loaded.</p>
    </main>
  );
}
EOF

cat > "$PAGES/FeedsPage.tsx" <<'EOF'
export default function FeedsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Feeds</h1>
      <p>Feeds loaded.</p>
    </main>
  );
}
EOF

# ---------------------------
# index.css (ANTI-WHITEOUT)
# ---------------------------
cat > "$ROOT/index.css" <<'EOF'
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background: var(--background, #ffffff);
  color: var(--foreground, #111111);
  font-family: system-ui, sans-serif;
}
EOF

echo "==> Fix complete."
echo "==> Start dev server: pnpm dev"
