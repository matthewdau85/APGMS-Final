"""Common abstractions for dataset feature builders."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterable

import pandas as pd
from great_expectations.dataset import PandasDataset

from ..config import DEFAULT_ARTIFACTS_ROOT
from ..data.prisma import PrismaDataSource

LOGGER = logging.getLogger(__name__)


class FeatureBuilder(ABC):
    """Base class for building and validating ML feature sets."""

    dataset_name: str
    expectations: dict[str, dict]

    def __init__(
        self,
        datasource: PrismaDataSource,
        artifacts_path: Path | None = None,
    ) -> None:
        self.datasource = datasource
        self.artifacts_path = Path(artifacts_path or DEFAULT_ARTIFACTS_ROOT)
        self.artifacts_path.mkdir(parents=True, exist_ok=True)

    @abstractmethod
    def extract(self) -> pd.DataFrame:
        """Pull the raw dataset from Prisma."""

    def transform(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Apply deterministic transformations to the extracted dataset."""

        return frame

    def postprocess(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Hook for derived classes to run after expectations pass."""

        return frame

    def build(self) -> pd.DataFrame:
        frame = self.transform(self.extract())
        self._apply_expectations(frame)
        result = self.postprocess(frame)
        self._persist_artifacts(result)
        return result

    def _apply_expectations(self, frame: pd.DataFrame) -> None:
        if not getattr(self, "expectations", None):
            LOGGER.info("No expectations configured for dataset %s", self.dataset_name)
            return
        dataset = PandasDataset(frame)
        for expectation, config in self.expectations.items():
            method = getattr(dataset, expectation)
            LOGGER.debug(
                "Running expectation %s with kwargs %s on %s",
                expectation,
                config,
                self.dataset_name,
            )
            result = method(**config)
            if not result.success:
                raise AssertionError(
                    f"Expectation {expectation} failed for {self.dataset_name}: {result.message}"
                )
        LOGGER.info("Expectations succeeded for %s", self.dataset_name)

    def _persist_artifacts(self, frame: pd.DataFrame) -> None:
        sample_path = self.artifacts_path / f"{self.dataset_name}_sample.csv"
        profile_path = self.artifacts_path / f"{self.dataset_name}_profile.json"
        LOGGER.info("Persisting dataset sample to %s", sample_path)
        frame.head(5).to_csv(sample_path, index=False)
        LOGGER.info("Persisting dataset profile to %s", profile_path)
        profile = {
            "dataset": self.dataset_name,
            "rows": int(frame.shape[0]),
            "columns": int(frame.shape[1]),
            "column_types": {column: str(dtype) for column, dtype in frame.dtypes.items()},
            "null_counts": {column: int(frame[column].isna().sum()) for column in frame.columns},
        }
        profile_path.write_text(json.dumps(profile, indent=2), encoding="utf-8")

    def required_columns(self) -> Iterable[str]:
        return []


__all__ = ["FeatureBuilder"]
