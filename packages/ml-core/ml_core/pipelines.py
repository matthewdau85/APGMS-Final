from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
import json

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier


@dataclass
class FeaturePipelineConfig:
    """Configuration for the compliance feature pipeline."""

    id_column: str = "eventId"
    timestamp_column: str = "generatedAt"
    categorical_features: Tuple[str, ...] = ("eventType", "orgId")
    numeric_features: Tuple[str, ...] = (
        "remediation_count",
        "fraud_case_count",
        "has_payment_plan",
        "schedule_size",
        "total_due",
        "confidence",
        "overdue",
    )
    target: str = "label"
    experiment_name: str = "compliance-monitoring"
    artifact_dir: Path = Path(__file__).resolve().parents[4] / "artifacts" / "ml-core"


class ComplianceFeaturePipeline:
    """End-to-end feature engineering and model training pipeline."""

    def __init__(self, config: FeaturePipelineConfig | None = None) -> None:
        self.config = config or FeaturePipelineConfig()
        self.config.artifact_dir.mkdir(parents=True, exist_ok=True)
        self.pipeline: Pipeline | None = None

    def build_dataset(self, samples: Iterable[Dict[str, Any]]) -> pd.DataFrame:
        """Flatten compliance training samples into a modelling DataFrame."""

        rows: List[Dict[str, Any]] = []
        for sample in samples:
            features = sample.get("features") or {}
            row: Dict[str, Any] = {
                "eventId": sample.get("eventId"),
                "orgId": sample.get("orgId"),
                "eventType": sample.get("eventType"),
                "generatedAt": sample.get("generatedAt"),
                "label": sample.get("label"),
            }
            for key, value in features.items():
                row[key] = value
            rows.append(row)

        df = pd.DataFrame(rows)
        if df.empty:
            return df

        if self.config.timestamp_column in df.columns:
            df[self.config.timestamp_column] = pd.to_datetime(
                df[self.config.timestamp_column], errors="coerce"
            )
            df[self.config.timestamp_column] = (
                df[self.config.timestamp_column].astype("int64") // 10**9
            )

        return df

    def persist_dataset(self, df: pd.DataFrame) -> Path:
        """Persist the assembled dataset and manifest for DSP evidence."""

        dataset_path = self.config.artifact_dir / "compliance_training.parquet"
        df.to_parquet(dataset_path, index=False)

        manifest = {
            "record_count": int(df.shape[0]),
            "feature_columns": [col for col in df.columns if col != self.config.target],
            "target_column": self.config.target,
            "policy_reference": "docs/compliance/dsp-operational-framework.md#compliance-analytics",
        }

        metadata_path = self.config.artifact_dir / "compliance_training_metadata.json"
        metadata_path.write_text(json.dumps(manifest, indent=2), encoding="utf8")
        return dataset_path

    def _build_preprocessor(self, feature_columns: List[str]) -> ColumnTransformer:
        categorical = [col for col in self.config.categorical_features if col in feature_columns]
        numeric = [col for col in self.config.numeric_features if col in feature_columns]

        transformers: List[Tuple[str, Pipeline, List[str]]] = []
        if categorical:
            transformers.append(
                (
                    "categorical",
                    Pipeline(
                        steps=[
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            ("encode", OneHotEncoder(handle_unknown="ignore")),
                        ]
                    ),
                    categorical,
                )
            )
        if numeric:
            transformers.append(
                (
                    "numeric",
                    Pipeline(
                        steps=[
                            ("imputer", SimpleImputer(strategy="median")),
                            ("scale", StandardScaler()),
                        ]
                    ),
                    numeric,
                )
            )

        return ColumnTransformer(transformers=transformers, remainder="drop")

    def train(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Train an XGBoost classifier and log metrics to MLflow."""

        if df.empty:
            return {"metrics": {}, "report_path": None, "pipeline": None}

        df = df.dropna(subset=[self.config.target])
        if df.empty:
            return {"metrics": {}, "report_path": None, "pipeline": None}

        feature_columns = [col for col in df.columns if col != self.config.target]
        X = df[feature_columns]
        y = df[self.config.target]

        stratify = y if y.nunique() > 1 else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=stratify
        )

        preprocessor = self._build_preprocessor(feature_columns)

        objective = "binary:logistic" if y.nunique() <= 2 else "multi:softprob"
        model = XGBClassifier(
            objective=objective,
            eval_metric="logloss",
            n_estimators=200,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
        )

        pipeline = Pipeline(steps=[("preprocess", preprocessor), ("model", model)])

        mlflow.set_experiment(self.config.experiment_name)
        with mlflow.start_run():
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)
            report = classification_report(
                y_test, y_pred, output_dict=True, zero_division=0
            )

            mlflow.log_params(
                {
                    "categorical_features": ",".join(self.config.categorical_features),
                    "numeric_features": ",".join(self.config.numeric_features),
                    "objective": objective,
                }
            )

            for label, metrics in report.items():
                if isinstance(metrics, dict):
                    for metric_name, value in metrics.items():
                        if isinstance(value, (int, float)) and np.isfinite(value):
                            mlflow.log_metric(f"{label}_{metric_name}", float(value))

            mlflow.sklearn.log_model(pipeline, "model")

        self.pipeline = pipeline

        report_path = self.config.artifact_dir / "compliance_training_metrics.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf8")

        return {"metrics": report, "report_path": report_path, "pipeline": pipeline}

    def run(self, samples: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        """Execute the full pipeline and persist artefacts."""

        df = self.build_dataset(samples)
        dataset_path = self.persist_dataset(df)
        training_result = self.train(df)
        training_result["dataset_path"] = dataset_path
        training_result["policy_reference"] = (
            "docs/compliance/dsp-operational-framework.md#compliance-analytics"
        )
        return training_result
