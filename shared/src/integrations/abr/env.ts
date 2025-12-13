export type AbrLookupMode = "stub" | "http";

export function abrEnv(env: NodeJS.ProcessEnv = process.env): {
  mode: AbrLookupMode;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
} {
  const mode = (env.ABR_LOOKUP_MODE || "stub") as AbrLookupMode;

  return {
    mode: mode === "http" ? "http" : "stub",
    baseUrl: env.ABR_BASE_URL || "https://example.invalid",
    apiKey: env.ABR_API_KEY || undefined,
    timeoutMs: Number(env.ABR_TIMEOUT_MS || "5000"),
  };
}

// Back-compat alias expected by validate-abn-or-tfn.ts
export const readAbrEnv = abrEnv;
