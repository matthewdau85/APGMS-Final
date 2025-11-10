"""Factory helpers for feature builders."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from ..config import DataSourceConfig
from ..data.prisma import PrismaDataSource
from .default_risk import PaymentPlanDefaultFeatureBuilder
from .fraud import FraudFeatureBuilder
from .shortfall import ShortfallFeatureBuilder

DatasetKind = Literal["shortfall", "fraud", "default_risk"]


@dataclass(slots=True)
class BuilderFactory:
    """Convenience factory that wires Prisma connectivity into builders."""

    datasource_config: DataSourceConfig

    def create(self, kind: DatasetKind, **kwargs):
        datasource = PrismaDataSource(self.datasource_config)
        if kind == "shortfall":
            return ShortfallFeatureBuilder(datasource, **kwargs)
        if kind == "fraud":
            return FraudFeatureBuilder(datasource, **kwargs)
        if kind == "default_risk":
            return PaymentPlanDefaultFeatureBuilder(datasource, **kwargs)
        raise ValueError(f"Unsupported dataset kind: {kind}")


__all__ = ["BuilderFactory", "DatasetKind"]
