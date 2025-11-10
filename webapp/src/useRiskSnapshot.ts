import { useCallback, useEffect, useState } from "react";

import { getRiskDashboard, type RiskDashboardResponse } from "./api";

export function useRiskSnapshot() {
  const [risk, setRisk] = useState<RiskDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRiskDashboard();
      setRisk(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { risk, error, loading, refresh };
}
