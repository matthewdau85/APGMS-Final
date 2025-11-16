import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import stpSchema from "./schemas/stp-phase-2.json";
import { SingleTouchPayrollPayload } from "./types.js";

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateFn = ajv.compile(stpSchema as Record<string, unknown>);

export function validateStpPayload(payload: SingleTouchPayrollPayload): SchemaValidationResult {
  const valid = Boolean(validateFn(payload));
  const errors = (validateFn.errors ?? []).map((error) => `${error.instancePath} ${error.message}`.trim());
  return { valid, errors };
}
