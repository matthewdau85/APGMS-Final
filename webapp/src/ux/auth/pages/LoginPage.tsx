import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession } from "../../../auth";
import { apiRequest } from "../../shared/data/apiClient";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await apiRequest<{
        token: string;
        expiresAt: string;
        user: { id: string; email: string; role: string; orgId: string };
      }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      saveSession(res);
      nav("/dashboard");
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button type="submit">Login</button>
        {error && <pre>{error}</pre>}
      </form>
    </div>
  );
}
