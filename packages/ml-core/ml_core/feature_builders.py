"""Feature builders for compliance ML workloads."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Optional

import mlflow
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

DEFAULT_OUTPUT = Path("artifacts/datasets/compliance_features.csv")


def build_discrepancy_features(database_url: str, schema: str = "public") -> pd.DataFrame:
    """Load compliance discrepancy features from Postgres into a DataFrame."""
    engine = create_engine(database_url)
    with engine.connect() as connection:
        discrepancy_query = text(
            f"""
            SELECT
              d.id AS discrepancy_id,
              d.org_id,
              d.external_ref,
              d.status,
              d.severity,
              d.category,
              d.detected_at,
              d.resolved_at,
              COALESCE(pp.amount_cents, 0) AS payment_plan_amount_cents,
              pp.status AS payment_plan_status,
              COUNT(DISTINCT fs.id) AS fraud_signal_count,
              COUNT(DISTINCT rem.id) FILTER (WHERE rem.status <> 'closed') AS remediation_open_count,
              COUNT(DISTINCT rem.id) AS remediation_total_count
            FROM {schema}."ComplianceDiscrepancy" d
            LEFT JOIN {schema}."CompliancePaymentPlan" pp ON pp.discrepancy_id = d.id
            LEFT JOIN {schema}."ComplianceFraudSignal" fs ON fs.discrepancy_id = d.id
            LEFT JOIN {schema}."ComplianceRemediation" rem ON rem.discrepancy_id = d.id
            GROUP BY d.id, d.org_id, d.external_ref, d.status, d.severity, d.category, d.detected_at,
                     d.resolved_at, pp.amount_cents, pp.status
            ORDER BY d.detected_at DESC
            """
        )
        base = pd.read_sql_query(discrepancy_query, connection)

        snapshot_query = text(
            f"""
            SELECT id, discrepancy_id, org_id, label, features, metadata
            FROM {schema}."ComplianceTrainingSnapshot"
            ORDER BY generated_at DESC
            """
        )
        snapshots = pd.read_sql_query(snapshot_query, connection)

    if snapshots.empty:
        base["label"] = "requires_review"
        return _augment_features(base)

    feature_rows = []
    for _, row in snapshots.iterrows():
        features_payload = row["features"]
        if isinstance(features_payload, str):
            features_payload = json.loads(features_payload)
        feature_rows.append({
            "discrepancy_id": row["discrepancy_id"],
            "snapshot_id": row["id"],
            "label": row.get("label", "requires_review"),
            **(features_payload or {}),
        })

    snapshot_df = pd.DataFrame(feature_rows)
    merged = base.merge(snapshot_df, how="left", on="discrepancy_id", suffixes=("", "_snapshot"))
    merged["label"] = merged["label"].fillna("requires_review")
    return _augment_features(merged)


def materialise_dataset(
    database_url: str,
    output_path: Optional[Path | str] = None,
    schema: str = "public",
) -> pd.DataFrame:
    """Materialise a dataset to ``artifacts/datasets`` and optionally log to MLflow."""
    if output_path is None:
        output_path = DEFAULT_OUTPUT
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    df = build_discrepancy_features(database_url, schema=schema)

    if output_path.suffix == ".parquet":
        try:
            df.to_parquet(output_path, index=False)
        except (ImportError, ValueError):
            fallback = output_path.with_suffix(".csv")
            df.to_csv(fallback, index=False)
            output_path = fallback
    else:
        df.to_csv(output_path, index=False)

    tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)
        with mlflow.start_run(run_name="compliance-dataset-materialisation"):
            mlflow.log_artifact(str(output_path), artifact_path="datasets")
            mlflow.log_metric("rows", len(df))
            mlflow.log_param("schema", schema)

    return df


def _augment_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["detected_at"] = pd.to_datetime(df["detected_at"], errors="coerce")
    df["resolved_at"] = pd.to_datetime(df.get("resolved_at"), errors="coerce")
    df["time_to_close_hours"] = (df["resolved_at"] - df["detected_at"]).dt.total_seconds() / 3600.0
    df["time_to_close_hours"] = df["time_to_close_hours"].fillna(0)

    severity_map = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}
    df["severity_score"] = df["severity"].str.lower().map(severity_map).fillna(0.4)

    df["has_payment_plan"] = np.where(df["payment_plan_amount_cents"].fillna(0) > 0, 1, 0)
    df["open_remediation_ratio"] = df.apply(
        lambda row: row["remediation_open_count"] / row["remediation_total_count"]
        if row["remediation_total_count"]
        else 0,
        axis=1,
    )
    df["fraud_signal_density"] = df["fraud_signal_count"].fillna(0) / (
        (pd.Timestamp.utcnow() - df["detected_at"]).dt.days.clip(lower=1)
    )
    df["fraud_signal_density"] = df["fraud_signal_density"].fillna(0)

    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Materialise compliance ML datasets")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="Postgres connection string")
    parser.add_argument("--schema", default="public", help="Database schema containing Prisma tables")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Output dataset path (CSV or Parquet)",
    )
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL must be provided via --database-url or environment variable")

    df = materialise_dataset(args.database_url, args.output, schema=args.schema)
    print(f"Wrote {len(df)} rows to {args.output}")


if __name__ == "__main__":
    main()
