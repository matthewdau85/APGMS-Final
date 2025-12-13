import { createHttpAbrClient } from "../integrations/abr/http-client.js";
import { createStubAbrClient } from "../integrations/abr/stub-client.js";
import { readAbrEnv } from "../integrations/abr/env.js";
import type { AbrLookupClient } from "../integrations/abr/types.js";

export type ValidateAbnOrTfnResult =
  | {
      kind: "ABN";
      value: string;
      isValidFormat: boolean;
      isVerified: boolean; // verified against ABR when in HTTP mode
      source: "abr" | "stub" | "none";
      entityName?: string;
      entityStatus?: string;
      reason?: string;
    }
  | {
      kind: "TFN";
      value: string;
      isValidFormat: boolean;
      isVerified: false; // TFN is not externally verifiable here
      source: "none";
      reason?: string;
    }
  | {
      kind: "UNKNOWN";
      value: string;
      isValidFormat: false;
      isVerified: false;
      source: "none";
      reason: string;
    };

function normalizeDigits(input: string): string {
  return String(input).replace(/\D+/g, "");
}

// ABN checksum (11 digits)
function isValidAbn(abnDigits: string): boolean {
  if (!/^\d{11}$/.test(abnDigits)) return false;

  const digits = abnDigits.split("").map((d) => Number(d));
  digits[0] = digits[0] - 1;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  return sum % 89 === 0;
}

// TFN checksum (9 digits; weights 1,4,3,7,5,8,6,9,10)
function isValidTfn(tfnDigits: string): boolean {
  if (!/^\d{9}$/.test(tfnDigits)) return false;

  const digits = tfnDigits.split("").map((d) => Number(d));
  const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  return sum % 11 === 0;
}

function resolveAbrClient(): { client: AbrLookupClient; source: "abr" | "stub"; mode: string } {
  const cfg = readAbrEnv();

  // Production must not silently use stub.
  const isProd = process.env.NODE_ENV === "production";

  if (cfg.mode === "stub") {
    if (isProd) throw new Error("ABR_VALIDATION_MODE=stub is not allowed in production");
    return { client: createStubAbrClient(), source: "stub", mode: "stub" };
  }

  if (cfg.mode === "http" || (cfg.mode === "auto" && isProd)) {
    if (!cfg.baseUrl) {
      throw new Error("ABR_LOOKUP_BASE_URL is required for ABR HTTP validation in production");
    }
    return {
      client: createHttpAbrClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs }),
      source: "abr",
      mode: "http",
    };
  }

  // auto in non-prod: allow stub fallback if not configured
  if (!cfg.baseUrl) {
    return { client: createStubAbrClient(), source: "stub", mode: "auto->stub" };
  }

  return {
    client: createHttpAbrClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, timeoutMs: cfg.timeoutMs }),
    source: "abr",
    mode: "auto->http",
  };
}

/**
 * Validates either ABN or TFN.
 * - ABN: checksum + (optionally) ABR verification via HTTP adapter
 * - TFN: checksum only (no external verification here)
 */
export async function validateAbnOrTfn(input: string): Promise<ValidateAbnOrTfnResult> {
  const digits = normalizeDigits(input);

  if (digits.length === 11) {
    const isValidFormat = isValidAbn(digits);
    if (!isValidFormat) {
      return {
        kind: "ABN",
        value: digits,
        isValidFormat: false,
        isVerified: false,
        source: "none",
        reason: "ABN checksum failed",
      };
    }

    const { client, source } = resolveAbrClient();
    const details = await client.lookupAbn(digits);

    return {
      kind: "ABN",
      value: digits,
      isValidFormat: true,
      isVerified: Boolean(details.isValid) && source === "abr",
      source,
      entityName: details.entityName,
      entityStatus: details.entityStatus,
      reason: details.isValid ? undefined : "ABR lookup returned not valid",
    };
  }

  if (digits.length === 9) {
    const isValidFormat = isValidTfn(digits);
    return {
      kind: "TFN",
      value: digits,
      isValidFormat,
      isVerified: false,
      source: "none",
      reason: isValidFormat ? undefined : "TFN checksum failed",
    };
  }

  return {
    kind: "UNKNOWN",
    value: digits,
    isValidFormat: false,
    isVerified: false,
    source: "none",
    reason: "Input is neither 11-digit ABN nor 9-digit TFN",
  };
}
