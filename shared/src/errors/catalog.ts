import { AppError, type FieldError } from "../errors.js";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface ErrorCatalogEntry {
  /** Canonical string identifier exposed over the API. */
  readonly code: string;
  /** Subsystem that emitted the error. */
  readonly domain: string;
  /** HTTP status returned to callers. */
  readonly httpStatus: number;
  /** Indicates if the caller can retry the request without changes. */
  readonly retryable: boolean;
  /** Severity level for logging/alerting. */
  readonly severity: ErrorSeverity;
  /** Human-friendly description that doubles as the default message. */
  readonly description: string;
  /** Optional remediation guidance surfaced to operators. */
  readonly remediation?: string;
}

export type CanonicalErrorCode = keyof typeof ERROR_CATALOG;
export type ErrorCatalog = typeof ERROR_CATALOG;

export const ERROR_CATALOG = {
  "auth.invalid_body": {
    code: "auth.invalid_body",
    domain: "auth",
    httpStatus: 400,
    retryable: false,
    severity: "error",
    description: "The request body failed validation.",
    remediation: "Double-check required fields and schema definitions before retrying.",
  },
  "auth.missing_user_context": {
    code: "auth.missing_user_context",
    domain: "auth",
    httpStatus: 401,
    retryable: true,
    severity: "warning",
    description: "Authentication context is missing or expired.",
    remediation: "Prompt the user to sign in again to refresh their session.",
  },
  "auth.mfa.totp.enrollment_missing": {
    code: "auth.mfa.totp.enrollment_missing",
    domain: "auth",
    httpStatus: 409,
    retryable: false,
    severity: "warning",
    description: "TOTP enrollment has not been started for this user.",
    remediation: "Restart the MFA enrollment flow from /auth/mfa/totp/begin.",
  },
  "auth.mfa.totp.invalid_token": {
    code: "auth.mfa.totp.invalid_token",
    domain: "auth",
    httpStatus: 401,
    retryable: true,
    severity: "warning",
    description: "The submitted TOTP code is invalid or expired.",
    remediation: "Ask the user to regenerate a TOTP code and re-enter it.",
  },
  "auth.mfa.passkey.registration_missing_response": {
    code: "auth.mfa.passkey.registration_missing_response",
    domain: "auth",
    httpStatus: 400,
    retryable: false,
    severity: "error",
    description: "WebAuthn registration response is required.",
    remediation: "Send the client-collected response from navigator.credentials.create().",
  },
  "auth.mfa.passkey.registration_failed": {
    code: "auth.mfa.passkey.registration_failed",
    domain: "auth",
    httpStatus: 401,
    retryable: true,
    severity: "error",
    description: "Passkey registration could not be verified.",
    remediation: "Retry the registration ceremony and ensure attestation data is intact.",
  },
  "auth.mfa.passkey.authentication_missing_response": {
    code: "auth.mfa.passkey.authentication_missing_response",
    domain: "auth",
    httpStatus: 400,
    retryable: false,
    severity: "error",
    description: "WebAuthn authentication response is required.",
    remediation: "Send the client-collected response from navigator.credentials.get().",
  },
  "auth.mfa.passkey.authentication_failed": {
    code: "auth.mfa.passkey.authentication_failed",
    domain: "auth",
    httpStatus: 401,
    retryable: true,
    severity: "error",
    description: "Passkey authentication could not be verified.",
    remediation: "Ensure the credential still exists and that the browser provided a fresh challenge.",
  },
  "auth.mfa.passkey.not_configured": {
    code: "auth.mfa.passkey.not_configured",
    domain: "auth",
    httpStatus: 404,
    retryable: false,
    severity: "warning",
    description: "No passkey credentials exist for this user.",
    remediation: "Enroll a passkey via the registration endpoint before requesting authentication options.",
  },
  "auth.mfa.passkey.not_found": {
    code: "auth.mfa.passkey.not_found",
    domain: "auth",
    httpStatus: 404,
    retryable: false,
    severity: "warning",
    description: "The referenced passkey credential is not registered.",
    remediation: "Ensure the credential ID matches a stored registration before verification.",
  },
  "platform.idempotency_key_missing": {
    code: "platform.idempotency_key_missing",
    domain: "platform",
    httpStatus: 400,
    retryable: false,
    severity: "error",
    description: "An Idempotency-Key header or payload key is required for this request.",
    remediation: "Generate a stable UUID per client operation and include it in the Idempotency-Key header.",
  },
  "platform.idempotency_conflict": {
    code: "platform.idempotency_conflict",
    domain: "platform",
    httpStatus: 409,
    retryable: false,
    severity: "error",
    description: "The supplied Idempotency-Key has already been used with different parameters.",
    remediation: "Reuse the prior request body or provide a brand new idempotency key.",
  },
  "banking.upstream_timeout": {
    code: "banking.upstream_timeout",
    domain: "banking",
    httpStatus: 504,
    retryable: true,
    severity: "warning",
    description: "The upstream banking API timed out before responding.",
    remediation: "Retry the transfer later or switch to a redundant banking provider.",
  },
  "banking.upstream_error": {
    code: "banking.upstream_error",
    domain: "banking",
    httpStatus: 502,
    retryable: true,
    severity: "error",
    description: "The upstream banking API rejected the request.",
    remediation: "Inspect provider logs for the root cause and re-submit when resolved.",
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export interface CatalogErrorOptions {
  readonly message?: string;
  readonly fields?: FieldError[];
  readonly overrides?: Partial<Pick<ErrorCatalogEntry, "httpStatus" | "retryable" | "severity">>;
  readonly includeMetadata?: boolean;
}

export interface CatalogResolution extends ErrorCatalogEntry {
  readonly code: string;
}

const normalizeCode = (code: string): string => code.trim().toLowerCase();

export const resolveCatalogEntry = (code: CanonicalErrorCode | string): CatalogResolution | undefined => {
  const normalized = normalizeCode(code);
  const entry = ERROR_CATALOG[normalized as CanonicalErrorCode];
  if (!entry) {
    return undefined;
  }
  return entry;
};

export const catalogError = (
  code: CanonicalErrorCode | string,
  options: CatalogErrorOptions = {},
): AppError => {
  const entry = resolveCatalogEntry(code);
  const httpStatus = options.overrides?.httpStatus ?? entry?.httpStatus ?? 500;
  const severity = options.overrides?.severity ?? entry?.severity ?? "error";
  const retryable = options.overrides?.retryable ?? entry?.retryable ?? false;
  const metadata = options.includeMetadata === false
    ? undefined
    : {
        severity,
        retryable,
        domain: entry?.domain ?? "unknown",
        remediation: entry?.remediation,
      } satisfies Record<string, unknown>;

  const message = options.message ?? entry?.description ?? "Unexpected error";
  const error = new AppError(httpStatus, entry?.code ?? code, message, options.fields, metadata);
  return error;
};

export const listErrorCatalog = (): CatalogResolution[] => Object.values(ERROR_CATALOG);
