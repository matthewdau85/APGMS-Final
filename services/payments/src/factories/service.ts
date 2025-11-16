import { createDesignatedAccountCreditService } from "./designated-credit.js";
import type { PaymentsService, PaymentsServiceDependencies } from "../types.js";

export function createPaymentsService(deps: PaymentsServiceDependencies): PaymentsService {
  return {
    creditDesignatedAccount: createDesignatedAccountCreditService(deps),
  };
}
