// packages/domain-policy/src/au-tax/paygw-engine.ts
import { TaxType, } from "./types";
/**
 * AU PAYGW engine that is entirely driven by TaxParameterSet and
 * TaxRateSchedule rows in the database.
 *
 * No numeric rates or thresholds are hard-coded here.
 */
export class PaygwEngine {
    constructor(configRepo) {
        this.configRepo = configRepo;
    }
    async calculate(input) {
        const { jurisdiction, paymentDate, grossCents } = input;
        const config = await this.configRepo.getActiveConfig({
            jurisdiction,
            taxType: TaxType.PAYGW,
            onDate: paymentDate,
        });
        const paygwConfig = this.assertPaygwConfig(config);
        const bracketIndex = this.findBracketIndex(paygwConfig.brackets, grossCents);
        if (bracketIndex < 0) {
            throw new Error(`No PAYGW bracket found for grossCents=${grossCents} in parameter set ${paygwConfig.meta.id}`);
        }
        const bracket = paygwConfig.brackets[bracketIndex];
        const withholdingCents = this.applyBracket(bracket, grossCents);
        return {
            withholdingCents,
            parameterSetId: paygwConfig.meta.id,
            bracketIndex,
        };
    }
    assertPaygwConfig(config) {
        const typed = config;
        if (!typed?.meta || !Array.isArray(typed.brackets)) {
            throw new Error("Invalid PAYGW config returned from repository");
        }
        return typed;
    }
    findBracketIndex(brackets, grossCents) {
        // Brackets are expected to be sorted ascending by thresholdCents.
        let index = -1;
        for (let i = 0; i < brackets.length; i += 1) {
            if (grossCents >= brackets[i].thresholdCents) {
                index = i;
            }
            else {
                break;
            }
        }
        return index;
    }
    applyBracket(bracket, grossCents) {
        const excessCents = Math.max(0, grossCents - bracket.thresholdCents);
        // milli-rate is rate * 1000, so divide by 1000 to obtain the fractional rate.
        const variableComponent = Math.floor((excessCents * bracket.marginalRateMilli) / 1000);
        const rawWithholding = bracket.baseWithholdingCents + variableComponent;
        // ATO tables typically round to whole dollars in the published schedule, but
        // this should be reflected in the schedule itself, not hard-coded here.
        return Math.max(0, rawWithholding);
    }
}
