// webapp/src/DashboardPage.tsx
import React, { useEffect, useState } from "react";
import { getToken, clearToken } from "./auth";
import { fetchUsers, fetchBankLines, createBankLine } from "./api";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<
    Array<{ userId: string; email: string; createdAt: string }>
  >([]);
  const [lines, setLines] = useState<
    Array<{ id: string; postedAt: string; amount: number; description: string; createdAt: string }>
  >([]);
  const [err, setErr] = useState("");

  // form to create new line
  const [newDate, setNewDate] = useState("2025-01-01T00:00:00.000Z");
  const [newAmount, setNewAmount] = useState("123.45");
  const [newPayee, setNewPayee] = useState("Test Vendor");
  const [newDesc, setNewDesc] = useState("Laptop purchase");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      nav("/");
      return;
    }

    (async () => {
      try {
        const [u, bl] = await Promise.all([
          fetchUsers(token),
          fetchBankLines(token),
        ]);
        setUsers(u.users);
        setLines(bl.lines);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErr("Failed to load dashboard (auth?)");
        setLoading(false);
      }
    })();
  }, [nav]);

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const token = getToken();
    if (!token) {
      nav("/");
      return;
    }
    try {
      await createBankLine(token, {
        date: newDate,
        amount: newAmount,
        payee: newPayee,
        desc: newDesc,
      });
      // refresh lines list
      const bl = await fetchBankLines(token);
      setLines(bl.lines);
    } catch (e) {
      console.error(e);
      setErr("Failed to create line");
    }
  }

  function handleLogout() {
    clearToken();
    nav("/");
  }

  if (loading) {
    return <div style={{ padding: 24, fontFamily: "system-ui" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: "24px", lineHeight: 1.4 }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "24px",
        alignItems: "center"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px" }}>Admin Dashboard</h1>
          <div style={{ fontSize: "13px", color: "#666" }}>
            Secure internal console (demo)
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid #aaa",
            borderRadius: 4,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Log out
        </button>
      </header>

      {err && (
        <div style={{ color: "red", marginBottom: "16px" }}>{err}</div>
      )}

      {/* Users */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>Users</h2>
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "6px",
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={thStyle}>User ID</th>
                <th style={thStyle}>Email (masked)</th>
                <th style={thStyle}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId}>
                  <td style={tdStyle}>{u.userId}</td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{u.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bank lines */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>
          Bank Lines
        </h2>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "6px",
            overflowX: "auto",
            marginBottom: "16px",
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Posted At</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln) => (
                <tr key={ln.id}>
                  <td style={tdStyle}>{ln.id}</td>
                  <td style={tdStyle}>{ln.postedAt}</td>
                  <td style={tdStyle}>{ln.amount}</td>
                  <td style={tdStyle}>{ln.description}</td>
                  <td style={tdStyle}>{ln.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add new line form */}
        <form
          onSubmit={handleAddLine}
          style={{
            display: "grid",
            gap: "12px",
            maxWidth: "400px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600 }}>
            Create new bank line
          </div>

          <label style={labelStyle}>
            <span>Date (ISO)</span>
            <input
              style={inputStyle}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </label>

          <label style={labelStyle}>
            <span>Amount</span>
            <input
              style={inputStyle}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
          </label>

          <label style={labelStyle}>
            <span>Payee</span>
            <input
              style={inputStyle}
              value={newPayee}
              onChange={(e) => setNewPayee(e.target.value)}
            />
          </label>

          <label style={labelStyle}>
            <span>Description</span>
            <input
              style={inputStyle}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </label>

          <button
            type="submit"
            style={{
              background: "black",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "8px 12px",
              fontSize: "14px",
              cursor: "pointer",
              justifySelf: "start",
            }}
          >
            Add Line
          </button>
        </form>
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "13px",
  borderBottom: "1px solid #eee",
  color: "#333",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  borderBottom: "1px solid #f2f2f2",
  color: "#111",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  fontSize: "13px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px",
  fontSize: "14px",
  borderRadius: "4px",
  border: "1px solid #ccc",
};
