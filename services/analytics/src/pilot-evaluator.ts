import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSeries } from "../../../shared/src/ledger/predictive.ts";

type PilotOrg = {
  orgId: string;
  name: string;
  industry: string;
  paygwHistory: number[];
  gstHistory: number[];
  actualNext: { paygw: number; gst: number };
};

type DatasetFile = {
  generatedAt: string;
  description: string;
  orgs: PilotOrg[];
};

type ModelPoint = {
  prediction: number;
  error: number;
  absError: number;
  mape: number;
  withinConfidence: boolean;
};

type SeriesReport = {
  actual: number;
  historyCount: number;
  confidence: ReturnType<typeof analyzeSeries>["confidence"];
  models: {
    ewma: ModelPoint;
    regression: ModelPoint;
  };
};

type OrgReport = {
  orgId: string;
  name: string;
  industry: string;
  paygw: SeriesReport;
  gst: SeriesReport;
};

type Aggregate = {
  mae: number;
  rmse: number;
  mape: number;
  coverage: number;
};

type AggregateState = {
  errors: number[];
  absErrors: number[];
  squaredErrors: number[];
  ape: number[];
  coverageHits: number;
};

function initAggregateState(): AggregateState {
  return { errors: [], absErrors: [], squaredErrors: [], ape: [], coverageHits: 0 };
}

function finalizeAggregate(state: AggregateState): Aggregate {
  const count = state.absErrors.length || 1;
  return {
    mae: state.absErrors.reduce((sum, value) => sum + value, 0) / count,
    rmse: Math.sqrt(state.squaredErrors.reduce((sum, value) => sum + value, 0) / count),
    mape: state.ape.reduce((sum, value) => sum + value, 0) / count,
    coverage: state.coverageHits / count,
  };
}

function evaluateSeries(history: number[], actual: number): SeriesReport {
  const analysis = analyzeSeries(history);
  const regressionPrediction = history.length > 0 ? history[history.length - 1] + analysis.trendDelta : 0;

  const buildPoint = (prediction: number): ModelPoint => {
    const error = prediction - actual;
    return {
      prediction,
      error,
      absError: Math.abs(error),
      mape: actual === 0 ? 0 : Math.abs(error / actual),
      withinConfidence: actual >= analysis.confidence.lower && actual <= analysis.confidence.upper,
    };
  };

  return {
    actual,
    historyCount: history.length,
    confidence: analysis.confidence,
    models: {
      ewma: buildPoint(analysis.forecast),
      regression: buildPoint(regressionPrediction),
    },
  };
}

function summarize(org: PilotOrg): OrgReport {
  return {
    orgId: org.orgId,
    name: org.name,
    industry: org.industry,
    paygw: evaluateSeries(org.paygwHistory, org.actualNext.paygw),
    gst: evaluateSeries(org.gstHistory, org.actualNext.gst),
  };
}

function buildDashboard(reports: OrgReport[], generatedAt: string) {
  const annotate = (report: OrgReport) => {
    const paygwDelta = report.paygw.models.ewma.error;
    const gstDelta = report.gst.models.ewma.error;
    const paygwStatus = Math.abs(paygwDelta) / Math.max(1, report.paygw.actual) > 0.15 ? "investigate" : "ok";
    const gstStatus = Math.abs(gstDelta) / Math.max(1, report.gst.actual) > 0.15 ? "investigate" : "ok";
    return {
      orgId: report.orgId,
      name: report.name,
      paygw: {
        actual: report.paygw.actual,
        forecast: report.paygw.models.ewma.prediction,
        status: paygwStatus,
        confidence: report.paygw.confidence,
      },
      gst: {
        actual: report.gst.actual,
        forecast: report.gst.models.ewma.prediction,
        status: gstStatus,
        confidence: report.gst.confidence,
      },
      regression: {
        paygw: report.paygw.models.regression.prediction,
        gst: report.gst.models.regression.prediction,
      },
    };
  };

  const investigations = reports.filter((r) => {
    const paygwDelta = Math.abs(r.paygw.models.ewma.error) / Math.max(1, r.paygw.actual);
    const gstDelta = Math.abs(r.gst.models.ewma.error) / Math.max(1, r.gst.actual);
    return paygwDelta > 0.15 || gstDelta > 0.15;
  });

  return {
    generatedAt,
    orgCount: reports.length,
    watchlist: investigations.map((report) => ({
      orgId: report.orgId,
      paygwErrorPct: report.paygw.models.ewma.mape,
      gstErrorPct: report.gst.models.ewma.mape,
      recommendation: "Schedule manual reconciliation and refresh ingestion logs.",
    })),
    rows: reports.map(annotate),
  };
}

function main() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const serviceRoot = path.resolve(moduleDir, "..");
  const projectRoot = path.resolve(serviceRoot, "..", "..");
  const datasetPath = path.resolve(projectRoot, "data", "pilot", "analytics", "pilot-cycles.json");
  const artifactDir = path.resolve(projectRoot, "artifacts", "analytics");
  fs.mkdirSync(artifactDir, { recursive: true });

  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as DatasetFile;
  const reports = dataset.orgs.map(summarize);

  const aggregates = {
    ewma: { paygw: initAggregateState(), gst: initAggregateState() },
    regression: { paygw: initAggregateState(), gst: initAggregateState() },
  } as const;

  for (const report of reports) {
    for (const model of ["ewma", "regression"] as const) {
      const paygwPoint = report.paygw.models[model];
      const gstPoint = report.gst.models[model];
      const paygwState = aggregates[model].paygw;
      const gstState = aggregates[model].gst;

      paygwState.errors.push(paygwPoint.error);
      paygwState.absErrors.push(paygwPoint.absError);
      paygwState.squaredErrors.push(paygwPoint.error ** 2);
      paygwState.ape.push(paygwPoint.mape);
      if (paygwPoint.withinConfidence) paygwState.coverageHits += 1;

      gstState.errors.push(gstPoint.error);
      gstState.absErrors.push(gstPoint.absError);
      gstState.squaredErrors.push(gstPoint.error ** 2);
      gstState.ape.push(gstPoint.mape);
      if (gstPoint.withinConfidence) gstState.coverageHits += 1;
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    dataset: {
      generatedAt: dataset.generatedAt,
      description: dataset.description,
      orgCount: dataset.orgs.length,
      path: path.relative(projectRoot, datasetPath),
    },
    metrics: {
      ewma: {
        paygw: finalizeAggregate(aggregates.ewma.paygw),
        gst: finalizeAggregate(aggregates.ewma.gst),
      },
      regression: {
        paygw: finalizeAggregate(aggregates.regression.paygw),
        gst: finalizeAggregate(aggregates.regression.gst),
      },
    },
    reports,
  };

  const evaluationPath = path.join(artifactDir, "pilot-model-evaluation.json");
  fs.writeFileSync(evaluationPath, JSON.stringify(summary, null, 2));

  const dashboardPath = path.join(artifactDir, "model-monitoring-dashboard.json");
  fs.writeFileSync(dashboardPath, JSON.stringify(buildDashboard(reports, summary.generatedAt), null, 2));

  process.stdout.write(
    `Evaluation complete. EWMA PAYGW MAE=${summary.metrics.ewma.paygw.mae.toFixed(2)} (coverage ${(summary.metrics.ewma.paygw.coverage * 100).toFixed(1)}%)\n`,
  );
  process.stdout.write(
    `Dashboard rows: ${reports.length}. Saved artifacts to ${path.relative(projectRoot, artifactDir)}.\n`,
  );
}

main();
