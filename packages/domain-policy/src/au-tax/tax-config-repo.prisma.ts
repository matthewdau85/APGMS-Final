import type { PrismaClient } from "@prisma/client";
import type { TaxConfigRepository } from "./types.js";
import { createTaxConfigRepositoryFromProvider } from "./tax-config-repo.from-provider.js";
import { auTaxConfigProvider } from "./au-tax-config-provider.js";

/**
 * Prisma-backed repository constructor.
 *
 * Mechanical fix:
 * - Do not pass PrismaClient into resolveAuTaxConfig().
 * - Wrap the provider using createTaxConfigRepositoryFromProvider().
 * - Keep the PrismaClient param for API compatibility, but unused here.
 */
export function prismaTaxConfigRepository(_prisma: PrismaClient): TaxConfigRepository {
  return createTaxConfigRepositoryFromProvider(auTaxConfigProvider);
}
