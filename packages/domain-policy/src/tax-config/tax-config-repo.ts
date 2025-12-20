import { auTaxConfigProvider } from "./au-tax-config-provider.js";
import { createTaxConfigRepositoryFromProvider } from "../au-tax/tax-config-repo.from-provider.js";

/**
 * Default repository instance for consumers inside this package.
 *
 * IMPORTANT:
 * - Prefer relative imports inside a package.
 * - Do not self-import from "@apgms/domain-policy" (causes export/cycle issues).
 */
export const taxConfigRepository = createTaxConfigRepositoryFromProvider(auTaxConfigProvider);
