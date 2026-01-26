import React, { useState } from "react";
import { apiRequest } from "../../ux/shared/data/apiClient";
import { getToken } from "../../auth";

export default function DemoControlPage() {
  const token = getToken();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    await apiRequest("/admin/demo/reset-and-seed", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg("Demo rebuilt.");
    setBusy(false);
  }

  return (
    <div>
      <h1>Demo Control</h1>
      <button onClick={run} disabled={busy}>
        {busy ? "Running..." : "Reset & Seed Demo"}
      </button>
      <div>{msg}</div>
    </div>
  );
}
