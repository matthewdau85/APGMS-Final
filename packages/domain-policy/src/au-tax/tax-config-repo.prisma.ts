import type { PrismaClient } from "@prisma/client";
import type { TaxConfigRepository } from "./types.js";
import { createTaxConfigRepositoryFromProvider } from "./tax-config-repo.from-provider.js";

/**
 * Prisma-backed repository constructor.
 *
 * Mechanical fix:
 * - Use PrismaClient as the data source for AU tax config tables.
 * - Keep the PrismaClient param for API compatibility.
 */
export function prismaTaxConfigRepository(prisma: PrismaClient): TaxConfigRepository {
  return createTaxConfigRepositoryFromProvider(prisma);
}
