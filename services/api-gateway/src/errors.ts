// services/api-gateway/src/errors.ts
// Centralised error codes and HTTP status mappings.

export const ERRORS = {
  IDP_CONFLICT: {
    code: "idempotency_conflict",
    status: 409,
    message: "The request has already been processed.",
  },
  INSUFFICIENT_FUNDS: {
    code: "insufficient_funds",
    status: 400,
    message: "Insufficient funds in designated account.",
  },
  INVALID_INPUT: {
    code: "invalid_input",
    status: 400,
    message: "The request contained invalid or missing data.",
  },
  EXTERNAL_SERVICE_ERROR: {
    code: "external_service_error",
    status: 502,
    message: "An external service failed or timed out.",
  },
  ABN_TFN_VALIDATION_FAILED: {
    code: "abn_tfn_validation_failed",
    status: 400,
    message: "ABN/TFN could not be validated.",
  },
} as const;

export type ErrorKey = keyof typeof ERRORS;
