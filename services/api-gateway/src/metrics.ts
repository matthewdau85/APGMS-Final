import { Gauge } from "prom-client";

export const riskCoverageGauge = new Gauge({
  name: "apgms_risk_coverage_pct",
  help: "Current % of PAYGW/GST coverage vs obligations",
});
