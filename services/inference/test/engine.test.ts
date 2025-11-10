import { test } from "node:test";
import assert from "node:assert/strict";

import { InferenceEngine } from "../src/model/engine.js";
import type { InferenceFeatureVector } from "@apgms/shared";

const engine = new InferenceEngine({
  version: "test",
  bias: -1,
  coefficients: {
    payrollVariance: 1,
    reconciliationLagDays: 0.5,
    transactionVolume: 0.001,
    alertDensity: 1.2,
  },
  thresholds: { medium: 0.5, high: 0.8 },
});

test("returns low risk for small feature values", () => {
  const features: InferenceFeatureVector = {
    payrollVariance: 0.1,
    reconciliationLagDays: 1,
    transactionVolume: 100,
    alertDensity: 0.05,
  };

  const result = engine.score(features);

  assert.equal(result.modelVersion, "test");
  assert.equal(result.riskBand, "low");
  assert.ok(result.score > 0 && result.score < 0.5);
});

test("escalates to high risk when thresholds are exceeded", () => {
  const features: InferenceFeatureVector = {
    payrollVariance: 4,
    reconciliationLagDays: 10,
    transactionVolume: 6000,
    alertDensity: 2,
  };

  const result = engine.score(features);

  assert.equal(result.riskBand, "high");
  assert.ok(result.score >= 0.8);
  const topFeature = result.contributingFeatures[0];
  assert.ok(Math.abs(topFeature.contribution) >= Math.abs(result.contributingFeatures[1].contribution));
});
