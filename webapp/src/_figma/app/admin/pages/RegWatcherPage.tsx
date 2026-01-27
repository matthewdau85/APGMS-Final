import React, { useEffect, useState } from "react";
import { apiRequest } from "../../shared/apiClient";
import { getSession } from "../../auth";

export default function RegWatcherPage() {
  const session = getSession();
  const [status, setStatus] = useState<any>(null);

  async function refresh() {
    const r = await apiRequest("/admin/regwatcher/status", {
      headers: { Authorization: `Bearer ${session?.token}` },
    });
    setStatus(r);
  }

  async function run() {
    await apiRequest("/admin/regwatcher/run", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.token}` },
    });
    refresh();
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <h2>RegWatcher</h2>
      <button onClick={run}>Run Scan</button>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  );
}
