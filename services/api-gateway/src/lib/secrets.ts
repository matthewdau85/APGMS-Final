let awsAvailable = false;
let SecretsManagerCtor: any | null = null;

async function ensureAws() {
  if (SecretsManagerCtor || awsAvailable) return;

  try {
    const mod = await import("@aws-sdk/client-secrets-manager");
    // v3 client name is SecretsManagerClient; we alias to keep generic
    SecretsManagerCtor = (mod as any).SecretsManagerClient ?? (mod as any).SecretsManager;
    awsAvailable = !!SecretsManagerCtor;
  } catch {
    awsAvailable = false;
  }
}

/**
 * Get a secret from AWS Secrets Manager, with optional env fallback.
 *
 * - key: the SecretId in AWS
 * - fallbackEnv: env var to use when AWS is unavailable
 * - json: parse value as JSON if true
 */
export async function getSecret(
  key: string,
  options?: { fallbackEnv?: string; json?: boolean },
): Promise<string | Record<string, unknown> | null> {
  await ensureAws();

  const envKey = options?.fallbackEnv ?? key;
  const envValue = process.env[envKey];

  // If AWS is not available at all, use env only
  if (!awsAvailable || !SecretsManagerCtor) {
    if (!envValue) return null;
    return options?.json ? JSON.parse(envValue) : envValue;
  }

  const client = new SecretsManagerCtor({});

  try {
    const res = await client.getSecretValue({ SecretId: key });
    const secretString = res.SecretString;
    if (!secretString) return null;
    return options?.json ? JSON.parse(secretString) : secretString;
  } catch {
    // On errors, fall back to env if present
    if (!envValue) return null;
    return options?.json ? JSON.parse(envValue) : envValue;
  }
}
