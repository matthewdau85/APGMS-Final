// Minimal jest-friendly mock for 'jose' used in auth.ts

export class SignJWT {
  private payload: any;

  constructor(payload: any) {
    this.payload = payload;
  }

  setProtectedHeader(_header: Record<string, unknown>) {
    // chainable
    return this;
  }

  setIssuedAt(_iat?: number | Date) {
    // chainable
    return this;
  }

  setExpirationTime(_exp: number | string | Date) {
    // chainable
    return this;
  }

  async sign(_key: unknown): Promise<string> {
    // Return a deterministic fake token for tests
    return "mock-jwt-token";
  }
}

export async function importJWK(_jwk: unknown, _alg?: string): Promise<unknown> {
  // We don’t actually verify JWTs in tests that hit /health or /ready,
  // so this can just return an empty object.
  return {};
}

// Export the JWK type alias in a way TypeScript is happy with in tests.
// At runtime this is just "any".
export type JWK = any;
