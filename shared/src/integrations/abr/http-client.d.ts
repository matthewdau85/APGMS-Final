import type { AbrLookupClient } from "./types.js";

export function createHttpAbrClient(opts: {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}): AbrLookupClient;
