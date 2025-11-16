import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCalibration,
  calibrateForecastEngine,
  computeTierStatus,
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
});
