// services/webapp/src/Dashboard.tsx
import React, { useEffect, useState } from "react";
import { getBankLines, createBankLine } from "./api";

interface Props {
  token: string;
}

export default function Dashboard({ token }: Props) {
  const [lines, setLines] = useState<
    Array<{
      id: string;
      postedAt: string;
      amount: number;
      description: string;
      createdAt: string;
    }>
  >([]);

  const [date, setDate] = useState("2025-01-01T00:00:00.000Z");
  const [amount, setAmount] = useState("123.45");
  const [payee, setPayee] = useState("Test Vendor");
  const [desc, setDesc] = useState("Laptop purchase");
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    try {
      const data = await getBankLines(token);
      setLines(data.lines);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await createBankLine(token, {
        date,
        amount,
        payee,
        desc,
      });
      await refresh();
    } catch (e: any) {
      setErr(e.message || "Failed to create");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h2>Dashboard</h2>
      {err && <div style={{ color: "red" }}>{err}</div>}

      <section style={{ marginBottom: "2rem" }}>
        <h3>New Ledger Line</h3>
        <form
          onSubmit={handleCreate}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", maxWidth: 600 }}
        >
          <label style={{ gridColumn: "span 2" }}>
            Date (ISO)
            <input
              style={{ width: "100%" }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label>
            Amount
            <input
              style={{ width: "100%" }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <label>
            Payee
            <input
              style={{ width: "100%" }}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            Description
            <input
              style={{ width: "100%" }}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>

          <div style={{ gridColumn: "span 2", textAlign: "right" }}>
            <button
              style={{
                padding: "0.5rem 1rem",
                background: "black",
                color: "white",
                borderRadius: 4,
              }}
              type="submit"
            >
              Add line
            </button>
          </div>
        </form>
      </section>

      <section>
        <h3>Bank Lines</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>ID</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Date</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>Amount</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Desc</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((ln) => (
              <tr key={ln.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: "4px 0" }}>{ln.id}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: "4px 0" }}>
                  {new Date(ln.postedAt).toISOString()}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "4px 0", textAlign: "right" }}>
                  {ln.amount}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "4px 0" }}>
                  {ln.description /* always '***' from API, that’s intentional */}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "4px 0" }}>
                  {new Date(ln.createdAt).toISOString()}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "#888" }}>
                  No lines yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
