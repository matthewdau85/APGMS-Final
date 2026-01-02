import React from "react";
import { useAuth } from "./auth/auth";

export default function AppMain(props: { onEnterAdmin: () => void }) {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div style={styles.page}>
      <header style={styles.top}>
        <div>
          <div style={styles.title}>APGMS</div>
          <div style={styles.sub}>Production shell (WIP) - Admin-only prototype is behind the Admin button</div>
        </div>

        <div style={styles.right}>
          <div style={styles.user}>
            <div style={{ fontWeight: 900 }}>{user?.name}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{user?.role}</div>
          </div>

          {isAdmin && (
            <button style={styles.btn} onClick={props.onEnterAdmin}>
              Admin
            </button>
          )}

          <button style={styles.btnGhost} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Next</div>
          <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.5 }}>
            Use the <b>Admin</b> button to open the full production-look prototype:
            Dashboard, Obligations, Ledger, Reconciliation, Evidence Pack, Controls & Policies, Incidents, Settings, Regulator Portal (read-only).
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Notes</div>
          <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.5 }}>
            The prototype uses mocked data and local-only state. It is intentionally designed to be wired later to your real
            policy engine, ledger, reconciliation workflow, and evidence pack generator.
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0b1020", color: "#e8ecff", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.12)" },
  title: { fontWeight: 900, fontSize: 18 },
  sub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  right: { display: "flex", gap: 10, alignItems: "center" },
  user: { textAlign: "right", paddingRight: 8, borderRight: "1px solid rgba(255,255,255,0.10)" },
  btn: { padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(120,140,255,0.35)", background: "rgba(120,140,255,0.20)", color: "#e8ecff", fontWeight: 900, cursor: "pointer" },
  btnGhost: { padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e8ecff", fontWeight: 800, cursor: "pointer" },
  main: { padding: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(12, 1fr)" },
  card: { gridColumn: "span 12", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", padding: 14 },
};
