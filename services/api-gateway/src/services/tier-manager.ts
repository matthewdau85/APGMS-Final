import type { PrismaClient } from "@prisma/client";

import { AppError } from "@apgms/shared";

export enum SubscriptionTier {
  Monitor = "Monitor",
  Reserve = "Reserve",
  Automate = "Automate",
}

const VALID_TIERS = new Set<string>([
  SubscriptionTier.Monitor,
  SubscriptionTier.Reserve,
  SubscriptionTier.Automate,
]);

function normalizeTier(value?: string | null): SubscriptionTier {
  if (value && VALID_TIERS.has(value)) {
    return value as SubscriptionTier;
  }
  return SubscriptionTier.Monitor;
}

export class TierManager {
  constructor(private readonly prisma: PrismaClient) {}

  async getTier(orgId: string): Promise<SubscriptionTier> {
    const record = await this.prisma.org.findUnique({
      where: { id: orgId },
      select: { tier: true },
    });
    if (!record) {
      throw new AppError(404, "org_not_found", "Organisation could not be found");
    }
    return normalizeTier(record.tier);
  }

  async setTier(orgId: string, tier: SubscriptionTier): Promise<SubscriptionTier> {
    if (!VALID_TIERS.has(tier)) {
      throw new AppError(400, "invalid_tier", "Unsupported subscription tier");
    }
    const updated = await this.prisma.org.update({
      where: { id: orgId },
      data: { tier },
      select: { tier: true },
    });
    return normalizeTier(updated.tier);
  }

  canAccessPredictions(tier: SubscriptionTier): boolean {
    return tier === SubscriptionTier.Reserve || tier === SubscriptionTier.Automate;
  }

  canAutomateTransfers(tier: SubscriptionTier): boolean {
    return tier === SubscriptionTier.Automate;
  }
}
