type SecurityLogEntry = {
  time: number;
  event: string;
  orgId?: string;
  principal?: string;
  metadata?: Record<string, unknown>;
};

const REDACTED = "***redacted***";

// Conservative PII key matchers
const PII_KEY_REGEX = /(tfn|abn|bank|account|bsb)/i;

// Conservative numeric PII value matcher
const PII_VALUE_REGEX = /\b\d{6,}\b/;

/**
 * Deeply redacts PII-like fields from metadata.
 */
function redactValue(value: unknown, key?: string): unknown {
  if (value == null) return value;

  // If key indicates PII, redact entirely
  if (key && PII_KEY_REGEX.test(key)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    // Redact numeric identifiers inside strings
    if (PII_VALUE_REGEX.test(value)) {
      return REDACTED;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v, k);
    }
    return out;
  }

  return value;
}

export function buildSecurityLogEntry(input: {
  event: string;
  orgId?: string;
  principal?: string;
  metadata?: Record<string, unknown>;
}): SecurityLogEntry {
  return {
    time: Date.now(),
    event: input.event,
    orgId: input.orgId,
    principal: input.principal,
    metadata: input.metadata
      ? (redactValue(input.metadata) as Record<string, unknown>)
      : undefined,
  };
}

export function buildSecurityLogLine(input: {
  event: string;
  orgId?: string;
  principal?: string;
  metadata?: Record<string, unknown>;
}): string {
  return JSON.stringify(buildSecurityLogEntry(input));
}
