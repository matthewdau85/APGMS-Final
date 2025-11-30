process.env.PII_KEYS = process.env.PII_KEYS || "k1:dummykey";
process.env.PII_ACTIVE_KEY = process.env.PII_ACTIVE_KEY || "k1";
process.env.PII_SALTS = process.env.PII_SALTS || "s1:dummysalt";
process.env.PII_ACTIVE_SALT = process.env.PII_ACTIVE_SALT || "s1";
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "0123456789abcdef0123456789abcdef";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/testdb";
process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "test-aud";
process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || "test-iss";
process.env.AUTH_DEV_SECRET = process.env.AUTH_DEV_SECRET || "dev-secret";
process.env.REGULATOR_ACCESS_CODE = process.env.REGULATOR_ACCESS_CODE || "reg-code";
process.env.PII_KEYS_ALGORITHM = process.env.PII_KEYS_ALGORITHM || "aes-256-gcm";
process.env.PORT = process.env.PORT || "3000";
process.env.HOST = process.env.HOST || "127.0.0.1";

jest.mock("@apgms/shared-au/abn", () => ({ isValidABN: () => true }), { virtual: true });
jest.mock("@apgms/shared-au/tfn", () => ({ isValidTFN: () => true }), { virtual: true });
jest.mock("@apgms/shared/security-log.js", () => ({
  logSecurityEvent: () => {},
  buildSecurityContextFromRequest: () => ({}),
  buildSecurityLogEntry: () => ({}),
}));
