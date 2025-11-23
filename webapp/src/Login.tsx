// services/webapp/src/Login.tsx
import React, { useState } from "react";
import { login } from "./api";

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("dev@example.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const session = await login(email, password);
      onLogin(session.token);
    } catch (e: any) {
      setErr(e.message || "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h2>Sign in</h2>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.5rem" }}>
        <label>
          Email
          <input
            style={{ width: "100%" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </label>

        <label>
          Password
          <input
            style={{ width: "100%" }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
        </label>

        {err && (
          <div style={{ color: "red", fontSize: "0.9rem" }}>{err}</div>
        )}

        <button
          style={{
            padding: "0.5rem 1rem",
            background: "black",
            color: "white",
            borderRadius: 4,
          }}
          type="submit"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
