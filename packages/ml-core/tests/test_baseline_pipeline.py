from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from ml_core.config import DataSourceConfig
from ml_core.feature_store.base import FeatureBuilder
from ml_core.pipelines.baseline import (
    BaselineTrainingConfig,
    build_default_config,
    train_payment_plan_default,
    train_shortfall_regression,
)


class _StubDataSource:
    pass


class _InMemoryBuilder(FeatureBuilder):
    dataset_name = "test_dataset"
    expectations = {}

    def __init__(self, frame: pd.DataFrame, artifacts_path: Path):
        super().__init__(_StubDataSource(), artifacts_path=artifacts_path)
        self._frame = frame

    def extract(self) -> pd.DataFrame:  # type: ignore[override]
        return self._frame


@pytest.fixture()
def tracking_uri(tmp_path: Path) -> str:
    mlruns = tmp_path / "mlruns"
    mlruns.mkdir(parents=True, exist_ok=True)
    uri = f"file:{mlruns.as_posix()}"
    yield uri


def test_shortfall_regression_pipeline(tmp_path: Path, tracking_uri: str) -> None:
    frame = pd.DataFrame(
        {
            "org_id": ["A", "B", "C", "D", "E", "F"],
            "net_cash_position": [100, 150, 90, 110, 200, 95],
            "expected_outflows": [120, 160, 130, 90, 210, 100],
            "incoming_payments": [10, 20, 15, 25, 30, 40],
            "projected_shortfall": [20, 10, 40, 0, 10, 5],
        }
    )
    builder = _InMemoryBuilder(frame, artifacts_path=tmp_path)
    config = BaselineTrainingConfig(
        experiment_name="test_shortfall",
        run_name="shortfall_test",
        feature_builder=builder,
        target_column="projected_shortfall",
        tracking_uri=tracking_uri,
    )

    result = train_shortfall_regression(config)
    assert {"rmse", "mae", "r2"}.issubset(result.metrics)
    sample_path = tmp_path / "test_dataset_sample.csv"
    assert sample_path.exists()


def test_payment_plan_default_pipeline(tmp_path: Path, tracking_uri: str) -> None:
    frame = pd.DataFrame(
        {
            "plan_id": [1, 2, 3, 4, 5, 6, 7, 8],
            "org_id": ["A", "A", "B", "B", "C", "C", "D", "D"],
            "plan_status": ["active", "delinquent", "active", "delinquent", "active", "closed", "active", "delinquent"],
            "scheduled_payment_count": [10, 10, 12, 12, 8, 8, 6, 6],
            "missed_payment_count": [0, 2, 1, 3, 0, 0, 0, 2],
            "total_balance": [1000, 900, 1100, 950, 800, 850, 600, 580],
            "average_payment_amount": [100, 90, 110, 95, 80, 85, 60, 58],
            "is_delinquent": [0, 1, 0, 1, 0, 0, 0, 1],
        }
    )
    builder = _InMemoryBuilder(frame, artifacts_path=tmp_path)
    config = BaselineTrainingConfig(
        experiment_name="test_default",
        run_name="default_test",
        feature_builder=builder,
        target_column="is_delinquent",
        tracking_uri=tracking_uri,
    )

    result = train_payment_plan_default(config)
    assert {"roc_auc", "average_precision", "f1", "precision", "recall"}.issubset(result.metrics)


def test_build_default_config_uses_factory_defaults() -> None:
    datasource = DataSourceConfig(database_url="sqlite:///:memory:")
    config = build_default_config("shortfall", datasource)
    assert isinstance(config.feature_builder, FeatureBuilder)
    assert config.target_column == "projected_shortfall"
