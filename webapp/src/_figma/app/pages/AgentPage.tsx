import React, { useEffect, useState } from "react";
import { apiRequest } from "../../shared/apiClient";
import { getSession } from "../../auth";

export default function AgentPage() {
  const session = getSession();
  const [runs, setRuns] = useState<any[]>([]);

  async function load() {
    const r = await apiRequest("/admin/agent/runs", {
      headers: { Authorization: `Bearer ${session?.token}` },
    });
    setRuns(r.runs);
  }

  async function run(job: string) {
    await apiRequest("/admin/agent/run", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.token}` },
      body: JSON.stringify({ job }),
    });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2>Agent</h2>
      <button onClick={() => run("demo-stress")}>Run Demo Stress</button>
      <pre>{JSON.stringify(runs, null, 2)}</pre>
    </div>
  );
}
