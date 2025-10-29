// webapp/src/LoginPage.tsx
import React, { useState } from "react";
import { login } from "./api";
import { saveToken } from "./auth";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("dev@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const { token } = await login(email, password);
      saveToken(token);
      nav("/dashboard");
    } catch (_) {
      setError("Login failed");
    }
  }

  return (
    <div style={{
      maxWidth: "360px",
      margin: "80px auto",
      padding: "24px",
      border: "1px solid #ccc",
      borderRadius: "8px",
      fontFamily: "system-ui, sans-serif"
    }}>
      <h1 style={{ fontSize: "20px", marginBottom: "16px" }}>
        APGMS Admin Login
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
        <label style={{ display: "grid", gap: "4px" }}>
          <span>Email</span>
          <input
            style={{ padding: "8px", fontSize: "14px" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label style={{ display: "grid", gap: "4px" }}>
          <span>Password</span>
          <input
            style={{ padding: "8px", fontSize: "14px" }}
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div style={{ color: "red", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{
            background: "black",
            color: "white",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer"
          }}
        >
          Sign in
        </button>

        <div style={{ fontSize: "12px", color: "#666" }}>
          (dev@example.com / admin123 in dev)
        </div>
      </form>
    </div>
  );
}
