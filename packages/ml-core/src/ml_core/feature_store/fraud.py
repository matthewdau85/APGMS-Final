"""Feature builder for fraud and anomaly detection."""

from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd

from .base import FeatureBuilder

LOGGER = logging.getLogger(__name__)


class FraudFeatureBuilder(FeatureBuilder):
    dataset_name = "fraud_features"
    expectations = {
        "expect_column_values_to_not_be_null": {"column": "transaction_id"},
        "expect_table_row_count_to_be_between": {"min_value": 1},
    }

    def __init__(
        self,
        datasource,
        view_name: str = "ml_transaction_anomaly_features",
        api_endpoint: str | None = None,
        **kwargs,
    ) -> None:
        super().__init__(datasource, **kwargs)
        self.view_name = view_name
        self.api_endpoint = api_endpoint

    def extract(self) -> pd.DataFrame:
        LOGGER.info("Pulling fraud features via view %s", self.view_name)
        frame = self.datasource.fetch_view(
            self.view_name,
            columns=self.required_columns(),
        )
        if frame.empty and self.api_endpoint:
            LOGGER.info("Falling back to Prisma API endpoint %s", self.api_endpoint)
            frame = self.datasource.fetch_api(self.api_endpoint)
        if frame.empty:
            LOGGER.warning("Fraud feature dataset is empty")
        return frame

    def transform(self, frame: pd.DataFrame) -> pd.DataFrame:
        frame = frame.copy()
        monetary_fields = [
            column for column in ["amount", "running_balance", "counterparty_velocity"] if column in frame
        ]
        for column in monetary_fields:
            frame[f"zscore_{column}"] = (frame[column] - frame[column].mean()) / frame[column].std(ddof=0)
        if "transaction_type" in frame.columns:
            frame = pd.get_dummies(frame, columns=["transaction_type"], prefix="txn_type", drop_first=True)
        return frame

    def required_columns(self) -> Iterable[str]:
        return [
            "transaction_id",
            "org_id",
            "amount",
            "running_balance",
            "transaction_type",
            "counterparty_velocity",
            "hour_of_day",
        ]


__all__ = ["FraudFeatureBuilder"]
