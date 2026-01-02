import React, { useMemo, useState } from "react";
import { useAuth, type UserRole } from "../auth/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [name, setName] = useState("Matthew");
  const [role, setRole] = useState<UserRole>("admin");

  const canSubmit = useMemo(() => name.trim().length >= 2, [name]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.logo}>APGMS</div>
          <div>
            <div style={styles.title}>Sign in</div>
            <div style={styles.subTitle}>Prototype environment (local demo auth)</div>
          </div>
        </div>

        <label style={styles.label}>Name</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
        />

        <label style={styles.label}>Role</label>
        <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>

        <button
          style={{ ...styles.button, opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? "pointer" : "not-allowed" }}
          disabled={!canSubmit}
          onClick={() => login({ name: name.trim(), role })}
        >
          Continue
        </button>

        <div style={styles.hint}>
          Admins get an <b>Admin</b> button in the top bar. Prototype is only accessible through that button.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#0b1020",
    color: "#e8ecff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  card: {
    width: "min(520px, 96vw)",
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    padding: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  brandRow: { display: "flex", gap: 14, alignItems: "center", marginBottom: 14 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(120,140,255,0.18)",
    border: "1px solid rgba(120,140,255,0.30)",
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  title: { fontSize: 18, fontWeight: 800 },
  subTitle: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontSize: 13, opacity: 0.9 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    color: "#e8ecff",
    outline: "none",
  },
  button: {
    width: "100%",
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(120,140,255,0.35)",
    background: "rgba(120,140,255,0.22)",
    color: "#e8ecff",
    fontWeight: 800,
  },
  hint: { marginTop: 12, fontSize: 12, opacity: 0.8, lineHeight: 1.4 },
};
