// services/webapp/src/LoginPage.tsx
import { useState } from "react";
import { login } from "./api";

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("dev@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { token } = await login(email, password);
      localStorage.setItem("apgmsToken", token);
      onLogin(token);
    } catch (err) {
      setError("Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>APGMS Admin Login</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          <div>Email</div>
          <input
            style={{ width: "100%" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          <div>Password</div>
          <input
            style={{ width: "100%" }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button type="submit">Sign in</button>
      </form>
      <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "1rem" }}>
        (dev@example.com / admin123 in dev)
      </p>
    </div>
  );
}
