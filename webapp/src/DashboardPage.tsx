// services/webapp/src/DashboardPage.tsx
import { useEffect, useState } from "react";
import { fetchBankLines, BankLine } from "./api";
import { BankLineForm } from "./BankLineForm";

export function DashboardPage({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [lines, setLines] = useState<BankLine[]>([]);
  const [error, setError] = useState("");

  async function loadLines() {
    try {
      setError("");
      const data = await fetchBankLines(token);
      setLines(data);
    } catch (err) {
      setError("Failed to load bank lines (auth maybe expired?)");
    }
  }

  useEffect(() => {
    void loadLines();
  }, [token]);

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <h1>APGMS Admin Dashboard</h1>
        <button
          onClick={() => {
            localStorage.removeItem("apgmsToken");
            onLogout();
          }}
        >
          Log out
        </button>
      </header>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      <section style={{ marginBottom: "2rem" }}>
        <BankLineForm
          token={token}
          onCreated={() => {
            void loadLines();
          }}
        />
      </section>

      <section>
        <h2>Bank Lines</h2>
        <p style={{ fontSize: "0.8rem", color: "#666" }}>
          PII fields are masked ("***") on purpose.
        </p>
        <div style={{ border: "1px solid #ccc", borderRadius: 8, overflowX: "auto" }}>
          <BankLineTable lines={lines} />
        </div>
      </section>
    </div>
  );
}
