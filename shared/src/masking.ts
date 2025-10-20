const SENSITIVE_KEY_PATTERNS = [
  "password",
  "token",
  "secret",
  "key",
  "authorization",
  "cookie",
  "session",
  "database_url",
  "databaseurl",
  "dsn",
];

const MASK = "***redacted***";

function shouldMaskKey(key: string | undefined): boolean {
  if (!key) return false;
  const normalised = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalised.includes(pattern));
}

function maskString(value: string): string {
  if (!value) {
    return MASK;
  }
  if (value.length <= 8) {
    return MASK;
  }
  const start = value.slice(0, 4);
  const end = value.slice(-2);
  return `${start}${"*".repeat(Math.max(3, value.length - 6))}${end}`;
}

function maskValue(value: unknown, key?: string): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return shouldMaskKey(key) ? MASK : maskPotentialSecret(value, key);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item, key));
  }
  if (typeof value === "object") {
    return maskObject(value as Record<string, unknown>);
  }
  return value;
}

function maskPotentialSecret(value: string, key?: string): string {
  if (shouldMaskKey(key)) {
    return MASK;
  }
  if (/password|secret|token|key/i.test(value)) {
    return MASK;
  }
  if (/^postgres(?:ql)?:\/\//i.test(value) || /^mongodb:\/\//i.test(value)) {
    return maskString(value);
  }
  if (value.length > 32) {
    return maskString(value);
  }
  return value;
}

export function maskObject<T>(input: T): T {
  if (input == null) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((value) => maskValue(value)) as unknown as T;
  }
  if (typeof input !== "object") {
    return maskValue(input) as T;
  }

  const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => [
    key,
    maskValue(value, key),
  ]);

  return Object.fromEntries(entries) as T;
}

export function maskError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const serialised: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    if (err.stack) {
      serialised.stack = err.stack.split("\n").slice(0, 5).join("\n");
    }
    if ((err as any).cause) {
      serialised.cause = maskValue((err as any).cause);
    }
    return maskObject(serialised);
  }
  if (typeof err === "object" && err !== null) {
    return maskObject(err as Record<string, unknown>);
  }
  return { error: maskValue(err) };
}
