// packages/domain-policy/src/au-tax/paygw-engine.js

import { TaxType } from "./types.js";

/**
 * Basic PAYGW engine that uses ATO-style "a * X − b" brackets.
 * Keeps behaviour simple and deterministic for now.
 */
export class PaygwEngine {
  constructor(repo) {
    this.repo = repo;
  }

  async calculate(input) {
    const { jurisdiction, payPeriod, asOf, grossIncomeCents } = input;

    const config = this.repo.getPaygwConfigForSchedule
      ? await this.repo.getPaygwConfigForSchedule(jurisdiction, payPeriod, asOf)
      : await this.repo.getActiveConfig({
          jurisdiction,
          taxType: TaxType.PAYGW,
          onDate: asOf,
        });

    // Tests expect /No PAYGW bracket found/ when nothing usable exists.
    if (!config || !config.brackets || config.brackets.length === 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const weeklyIncome = this.toWeekly(grossIncomeCents, payPeriod);
    const bracket = this.findBracket(config.brackets, weeklyIncome);

    if (!bracket) {
      // Config exists but does not contain a suitable bracket.
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const bracketIndex = config.brackets.indexOf(bracket);

    // If the bracket is misconfigured, fall back to zero withholding but
    // still report which bracket was selected.
    if (bracket.a == null || bracket.b == null) {
      return {
        withholdingCents: 0,
        withheldCents: 0,
        bracketIndex,
        parameterSetId: config.meta.id,
        configUsed: config,
      };
    }

    const taxWeekly = weeklyIncome * bracket.a - bracket.b;
    const taxForPeriod = this.fromWeekly(taxWeekly, payPeriod);
    const withholdingCents = Math.max(0, Math.round(taxForPeriod));

    return {
      withholdingCents,
      withheldCents: withholdingCents,
      bracketIndex,
      parameterSetId: config.meta.id,
      configUsed: config,
    };
  }

  toWeekly(amountCents, period) {
    switch (period) {
      case "WEEKLY":
        return amountCents;
      case "FORTNIGHTLY":
        return amountCents / 2;
      case "MONTHLY":
        return (amountCents * 12) / 52;
      default:
        return amountCents;
    }
  }

  fromWeekly(amountCents, period) {
    switch (period) {
      case "WEEKLY":
        return amountCents;
      case "FORTNIGHTLY":
        return amountCents * 2;
      case "MONTHLY":
        return (amountCents * 52) / 12;
      default:
        return amountCents;
    }
  }

  findBracket(brackets, weeklyIncome) {
    for (const b of brackets) {
      if (b.weeklyLessThan == null || weeklyIncome < b.weeklyLessThan) {
        return b;
      }
    }
    return undefined;
  }
}
