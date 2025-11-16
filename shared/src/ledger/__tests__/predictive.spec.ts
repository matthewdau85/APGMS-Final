import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCalibration,
  buildForecastNarrative,
  calibrateForecastEngine,
  computeTierStatus,
  deriveCalibrationFromCsv,
  type ForecastResult,
} from "../predictive.js";

describe("predictive helpers", () => {
  it("calibrates bias and recommended alpha", () => {
    const calibration = calibrateForecastEngine([
      { actualPaygw: 1000, forecastPaygw: 900, actualGst: 500, forecastGst: 450 },
      { actualPaygw: 1200, forecastPaygw: 1000, actualGst: 400, forecastGst: 380 },
    ]);

    assert.ok(calibration.bias.paygw > 0);
    assert.ok(calibration.bias.gst > 0);
    assert.ok(calibration.recommendedMargin > 0);
    assert.ok(calibration.recommendedAlpha <= 0.75);
  });

  it("applies calibration to forecast results", () => {
    const calibration = calibrateForecastEngine([
      { actualPaygw: 1000, forecastPaygw: 900, actualGst: 400, forecastGst: 450 },
    ]);

    const forecast: ForecastResult = {
      paygwForecast: 950,
      gstForecast: 425,
      baselineCycles: 1,
      trend: { paygwDelta: 5, gstDelta: -3 },
    };

    const adjusted = applyCalibration(forecast, calibration);
    assert.ok(adjusted.paygwForecast > forecast.paygwForecast);
    assert.notEqual(adjusted.paygwForecast, forecast.paygwForecast);
  });

  it("keeps tier state stable with margin", () => {
    const tier = computeTierStatus(1_500, 1_000, 200);
    assert.equal(tier, "reserve");
  });

  it("produces a narrative with confidence bands", () => {
    const forecast: ForecastResult = {
      paygwForecast: 1000,
      gstForecast: 400,
      baselineCycles: 6,
      trend: { paygwDelta: 10, gstDelta: -5 },
    };
    const calibration = calibrateForecastEngine([
      { actualPaygw: 1050, forecastPaygw: 1000, actualGst: 390, forecastGst: 380 },
    ]);
    const narrative = buildForecastNarrative(forecast, calibration);
    assert.equal(narrative.confidence, "high");
    assert.ok(narrative.summary.includes("PAYGW obligations"));
    assert.ok(narrative.highlights.length >= 4);
    assert.ok(narrative.recommendedActions[0].length > 0);
  });

  it("derives calibration from CSV rows", () => {
    const csv = [
      "actual_paygw,forecast_paygw,actual_gst,forecast_gst",
      "1000,900,400,380",
      "950,1000,410,390",
    ].join("\n");

    const calibration = deriveCalibrationFromCsv(csv);
    assert.ok(calibration.recommendedMargin > 0);
    assert.ok(calibration.mape.paygw >= 0);
  });
});
