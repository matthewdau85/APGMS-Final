import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchTierTuning, triggerTierCheck, updateTierTuning, type TierCheckResult, type TierTuningConfig } from "../api.js";

export type TierTuningHookState = {
  config: TierTuningConfig | null;
  loading: boolean;
  error: string | null;
  results: TierCheckResult[];
  refresh: () => Promise<void>;
  save: (payload: Partial<Pick<TierTuningConfig, "marginPercent" | "schedule">>) => Promise<void>;
  runTierCheck: (options?: { force?: boolean; orgIds?: string[] }) => Promise<TierCheckResult[]>;
};

export function useTierTuning(baseUrl = ""): TierTuningHookState {
  const [config, setConfig] = useState<TierTuningConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TierCheckResult[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchTierTuning(baseUrl);
      setConfig(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const save = useCallback(
    async (payload: Partial<Pick<TierTuningConfig, "marginPercent" | "schedule">>) => {
      setError(null);
      try {
        const next = await updateTierTuning(payload, baseUrl);
        setConfig(next);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [baseUrl],
  );

  const runTierCheck = useCallback(
    async (options: { force?: boolean; orgIds?: string[] } = {}) => {
      setError(null);
      try {
        const response = await triggerTierCheck(options, baseUrl);
        setResults(response);
        return response;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [baseUrl],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ config, loading, error, results, refresh, save, runTierCheck }),
    [config, loading, error, results, refresh, save, runTierCheck],
  );
}
