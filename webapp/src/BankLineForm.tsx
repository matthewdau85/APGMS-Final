// services/webapp/src/BankLineForm.tsx
import { useState } from "react";
import { createBankLine } from "./api";

export function BankLineForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
}) {
  const [date, setDate] = useState("2025-01-01T00:00:00.000Z");
  const [amount, setAmount] = useState("123.45");
  const [payee, setPayee] = useState("Test Vendor");
  const [desc, setDesc] = useState("Laptop purchase");
  const [error, setError] = useState("");
  const [riskMessage, setRiskMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const response = await createBankLine(token, { date, amount, payee, desc });
      if (response.risk) {
        setRiskMessage(`${response.risk.riskLevel.toUpperCase()} risk — ${response.risk.recommendedAction}`);
      } else {
        setRiskMessage("Transfer accepted without ML flags.");
      }
      onCreated();
    } catch (err) {
      const payload = (err as any)?.payload as { risk?: { riskLevel: string; recommendedAction: string } } | undefined;
      if (payload?.risk) {
        setError(`${payload.risk.riskLevel.toUpperCase()} risk — ${payload.risk.recommendedAction}`);
      } else {
        setError("Failed to create");
      }
      setRiskMessage(null);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: "0.5rem",
        border: "1px solid #ccc",
        padding: "1rem",
        borderRadius: 8,
      }}
    >
      <h2>New Bank Line</h2>

      <label>
        <div>Date (ISO)</div>
        <input value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label>
        <div>Amount</div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>

      <label>
        <div>Payee</div>
        <input value={payee} onChange={(e) => setPayee(e.target.value)} />
      </label>

      <label>
        <div>Description</div>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>

      {riskMessage && <div style={{ color: "#1a202c" }}>{riskMessage}</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      <button type="submit">Create Line</button>
    </form>
  );
}
