"""Feature builder for treasury shortfall prediction."""

from __future__ import annotations

import logging
from typing import Iterable

import pandas as pd

from ..data.prisma import PrismaDataSource
from .base import FeatureBuilder

LOGGER = logging.getLogger(__name__)


class ShortfallFeatureBuilder(FeatureBuilder):
    dataset_name = "shortfall_features"
    expectations = {
        "expect_column_values_to_not_be_null": {"column": "org_id"},
        "expect_table_row_count_to_be_between": {"min_value": 1},
    }

    def __init__(self, datasource: PrismaDataSource, view_name: str = "ml_shortfall_features", **kwargs):
        super().__init__(datasource, **kwargs)
        self.view_name = view_name

    def extract(self) -> pd.DataFrame:
        LOGGER.info("Pulling shortfall features from view %s", self.view_name)
        return self.datasource.fetch_view(
            self.view_name,
            columns=self.required_columns(),
        )

    def transform(self, frame: pd.DataFrame) -> pd.DataFrame:
        frame = frame.copy()
        if "net_cash_position" in frame.columns and "expected_outflows" in frame.columns:
            frame["projected_shortfall"] = frame["expected_outflows"] - frame["net_cash_position"]
        if "projected_shortfall" in frame.columns:
            frame["projected_shortfall"] = frame["projected_shortfall"].clip(lower=0)
        return frame

    def required_columns(self) -> Iterable[str]:
        return [
            "org_id",
            "as_of_date",
            "net_cash_position",
            "expected_outflows",
            "incoming_payments",
        ]


__all__ = ["ShortfallFeatureBuilder"]
