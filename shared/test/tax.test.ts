import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateGst,
  calculatePaygw,
  calculateSchedule1Withholding,
  calculateStslRepayment,
  calculateWorkingHolidayMakerWithholding,
} from "../src/tax/index.js";
import {
  GST_RATE,
  PAYGW_SCHEDULE1_COEFFICIENTS,
  PAYGW_WORKING_HOLIDAY_BRACKETS,
  STSL_THRESHOLDS,
} from "../src/tax/tables.js";

describe("tax calculators", () => {
  it("calculates GST with default rate", () => {
    const result = calculateGst({ amount: 110, rate: GST_RATE });
    assert.equal(result.gstPortion, 10);
    assert.equal(result.netOfGst, 100);
  });

  it("calculates PAYGW using provided brackets", () => {
    const result = calculatePaygw({
      taxableIncome: 2000,
      brackets: [
        { threshold: 720, rate: 0.0, base: 0 },
        { threshold: 3610, rate: 0.19, base: 0 },
      ],
    });

    assert.equal(result.withheld, 380);
    assert.ok(result.effectiveRate > 0);
  });

  it("handles non-positive amounts gracefully", () => {
    const gst = calculateGst({ amount: -50, rate: GST_RATE });
    assert.equal(gst.gstPortion, 0);
    assert.equal(gst.netOfGst, -50);

    const paygw = calculatePaygw({
      taxableIncome: 0,
      brackets: [],
    });
    assert.equal(paygw.withheld, 0);
  });

  it("calculates working holiday maker withholding", () => {
    const result = calculateWorkingHolidayMakerWithholding({
      taxableIncome: 50_000,
      brackets: PAYGW_WORKING_HOLIDAY_BRACKETS,
    });
    assert.equal(result.withheld, 8_250);
  });

  it("calculates STSL repayment", () => {
    const repayment = calculateStslRepayment({
      taxableIncome: 130_000,
      thresholds: STSL_THRESHOLDS,
    });
    assert.equal(repayment, 7_550);
  });

  it("calculates Schedule 1 withholding for scale 2 weekly payments", () => {
    const withholding = calculateSchedule1Withholding({
      gross: 900,
      payPeriod: "weekly",
      scale: "scale2WithTaxFreeThreshold",
      coefficients: PAYGW_SCHEDULE1_COEFFICIENTS,
    });

    assert.equal(withholding.withheld, 111);
  });

  it("calculates Schedule 1 withholding for scale 1 monthly payments", () => {
    const withholding = calculateSchedule1Withholding({
      gross: 4_000,
      payPeriod: "monthly",
      scale: "scale1NoTaxFreeThreshold",
      coefficients: PAYGW_SCHEDULE1_COEFFICIENTS,
    });

    assert.ok(withholding.withheld > 0);
  });
});
