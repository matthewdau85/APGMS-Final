# Configuring industry rule coverage

1. **Select the industry profile**
   - Hospitality & Tourism (`hospitality_tourism`)
   - Construction & Trades (`construction_trades`)
   - Healthcare & Allied (`healthcare_allied`)

2. **Feed workforce + revenue context**
   - Payroll adapters forward `seasonalRatio`, `apprenticeCount`,
     `remoteWorkforcePercent`, `healthcareExemptRatio`, `exportRatio`, and
     `annualTaxableTurnover` to the `IndustryRuleEngine`.
   - POS adapters forward the relevant revenue metrics (e.g., export ratio,
     NFP status) so GST concessions can be applied.

3. **Choose adapters**
   - `providers/payroll/xero.ts` prioritises a single PAYGW schedule based on
     the workforce mix (casual vs salaried).
   - `providers/payroll/employment-hero.ts` evaluates both PAYGW schedules per
     industry so SMEs can compare withholding outcomes.
   - `providers/pos/square.ts` and `providers/pos/lightspeed.ts` map POS sales
     into the GST schedule while honouring exemptions such as remote resort
     relief or NFP health suspensions.

4. **Verify with regression tests**
   - `tests/tax/test_industry_rules.py` validates seasonal, apprentice and NFP
     scenarios directly against the JSON catalog.

5. **Update SME notes when policies change**
   - Append context to `smeNotes` and adjust conditions in
     `shared/src/rules/industry-rules.json`. The engine and adapters consume the
     file at runtime so no further wiring is required.
