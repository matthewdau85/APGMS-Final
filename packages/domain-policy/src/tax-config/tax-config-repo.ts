import { auTaxConfigProvider } from "./au-tax-config-provider.js";
import { createTaxConfigRepositoryFromProvider } from "@apgms/domain-policy";

export const taxConfigRepo = createTaxConfigRepositoryFromProvider(auTaxConfigProvider);
