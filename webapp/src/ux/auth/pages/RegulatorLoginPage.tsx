import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../shared/data/apiClient";
import { setRegulatorSession } from "../../../auth";

export default function RegulatorLoginPage() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await apiRequest<{
        token: string;
        expiresAt: string;
      }>("/api/regulator/login", {
        method: "POST",
        body: { accessCode: code },
      });

      setRegulatorSession(res);
      nav("/regulator");
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Regulator access</h1>
      <form onSubmit={submit}>
        <input
          placeholder="access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <br />
        <button type="submit">Enter</button>
        {error && <pre>{error}</pre>}
      </form>
    </div>
  );
}
