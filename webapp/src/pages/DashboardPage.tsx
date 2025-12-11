import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api-client";

type RiskSummary = {
  status: string;
  overallLevel: string;
};

const DashboardPage = () => {
  const { data, isLoading, error } = useQuery<RiskSummary>({
    queryKey: ["riskSummary"],
    queryFn: () =>
      apiRequest<RiskSummary>("/monitor/risk/summary", {
        method: "GET",
        orgId: "org-demo-1",
      }),
  });

  if (isLoading) {
    return <div>Loading dashboard…</div>;
  }

  if (error) {
    return <div>Failed to load dashboard.</div>;
  }

  return (
    <main>
      <h1>APGMS Dashboard</h1>
      <p>Status: {data?.status ?? "unknown"}</p>
      <p>Overall level: {data?.overallLevel ?? "unknown"}</p>
    </main>
  );
};

export default DashboardPage;
