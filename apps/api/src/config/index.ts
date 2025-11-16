import assert from "node:assert/strict";

import type { BankingProviderId } from "../../../../providers/banking/types.js";

export type BankingApiConfig = {
  providerId: BankingProviderId | string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
};

export type ApiConfig = {
  banking: BankingApiConfig;
};

const readRequired = (env: NodeJS.ProcessEnv, key: string): string => {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

const parseTimeout = (value: string | undefined, key: string): number => {
  if (!value) {
    return 10_000;
  }
  const parsed = Number.parseInt(value, 10);
  assert(!Number.isNaN(parsed) && parsed > 0, `${key} must be a positive number`);
  return parsed;
};

const validateUrl = (value: string, key: string): string => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch (error) {
    throw new Error(`${key} must be a valid URL: ${(error as Error).message}`);
  }
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const banking: BankingApiConfig = {
    providerId: (env.BANKING_PROVIDER_ID ?? "mock") as BankingProviderId | string,
    baseUrl: validateUrl(readRequired(env, "BANKING_API_BASE_URL"), "BANKING_API_BASE_URL"),
    apiKey: readRequired(env, "BANKING_API_KEY"),
    timeoutMs: parseTimeout(env.BANKING_API_TIMEOUT_MS, "BANKING_API_TIMEOUT_MS"),
  };

  return { banking } satisfies ApiConfig;
}

export const config = loadConfig();
