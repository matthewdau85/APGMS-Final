import React, { useState } from "react";
import { apiRequest } from "../../shared/apiClient";
import { getSession } from "../../auth";

export default function DemoControlPage() {
  const session = getSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    await apiRequest("/admin/demo/reset-and-seed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.token}`,
      },
    });
    setMsg("Demo rebuilt.");
    setBusy(false);
  }

  return (
    <div>
      <h2>Demo Control</h2>
      <button disabled={busy} onClick={run}>
        {busy ? "Running..." : "Reset & Seed Demo"}
      </button>
      <div>{msg}</div>
    </div>
  );
}
