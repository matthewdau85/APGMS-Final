export type TierSchedule = {
  frequencyHours: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

export type TierTuningConfig = {
  marginPercent: number;
  schedule: {
    defaultFrequencyHours: number;
    orgOverrides: Record<string, number>;
  };
  updatedAt: string;
};

export type TierCheckResult = {
  orgId: string;
  skipped?: boolean;
  reason?: string;
  tierStatus?: Record<string, string>;
  forecast?: unknown;
  escalationAlertId?: string | null;
  schedule: TierSchedule;
};

async function handleResponse(response: Response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchTierTuning(baseUrl = ""): Promise<TierTuningConfig> {
  const res = await fetch(`${baseUrl}/admin/tier-tuning`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = (await handleResponse(res)) as { config: TierTuningConfig };
  return data.config;
}

export async function updateTierTuning(
  payload: Partial<Pick<TierTuningConfig, "marginPercent" | "schedule">>,
  baseUrl = "",
): Promise<TierTuningConfig> {
  const res = await fetch(`${baseUrl}/admin/tier-tuning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = (await handleResponse(res)) as { config: TierTuningConfig };
  return data.config;
}

export async function triggerTierCheck(
  payload: { force?: boolean; orgIds?: string[] } = {},
  baseUrl = "",
): Promise<TierCheckResult[]> {
  const res = await fetch(`${baseUrl}/compliance/tier-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = (await handleResponse(res)) as { results: TierCheckResult[] };
  return data.results;
}
