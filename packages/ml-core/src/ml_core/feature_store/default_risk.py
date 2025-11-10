"""Feature builder for payment plan default risk modeling."""

from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd

from .base import FeatureBuilder

LOGGER = logging.getLogger(__name__)


class PaymentPlanDefaultFeatureBuilder(FeatureBuilder):
    dataset_name = "payment_plan_default_features"
    expectations = {
        "expect_column_values_to_not_be_null": {"column": "plan_id"},
        "expect_column_values_to_be_in_set": {
            "column": "plan_status",
            "value_set": ["active", "delinquent", "closed"],
        },
    }

    def __init__(self, datasource, view_name: str = "ml_payment_plan_features", **kwargs):
        super().__init__(datasource, **kwargs)
        self.view_name = view_name

    def extract(self) -> pd.DataFrame:
        LOGGER.info("Pulling payment plan default features from %s", self.view_name)
        return self.datasource.fetch_view(
            self.view_name,
            columns=self.required_columns(),
        )

    def transform(self, frame: pd.DataFrame) -> pd.DataFrame:
        frame = frame.copy()
        if "missed_payment_count" in frame.columns and "scheduled_payment_count" in frame.columns:
            frame["missed_payment_ratio"] = (
                frame["missed_payment_count"] / frame["scheduled_payment_count"].clip(lower=1)
            )
        if "plan_status" in frame.columns:
            frame["is_delinquent"] = frame["plan_status"].isin(["delinquent"]).astype(int)
        return frame

    def required_columns(self) -> Iterable[str]:
        return [
            "plan_id",
            "org_id",
            "plan_status",
            "scheduled_payment_count",
            "missed_payment_count",
            "total_balance",
            "average_payment_amount",
        ]


__all__ = ["PaymentPlanDefaultFeatureBuilder"]
