"""Data access helpers for Prisma-backed SQL views and HTTP APIs."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Iterable

import pandas as pd
import requests
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from ..config import DataSourceConfig

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PrismaDataSource:
    """Provides unified access to Prisma data through SQL views or REST endpoints."""

    config: DataSourceConfig

    def _build_engine(self) -> Engine | None:
        if not self.config.database_url:
            return None
        LOGGER.debug("Creating SQLAlchemy engine for %s", self.config.database_url)
        return create_engine(self.config.database_url, pool_pre_ping=True)

    def fetch_view(
        self,
        view_name: str,
        columns: Iterable[str] | None = None,
        where_clause: str | None = None,
        params: dict[str, Any] | None = None,
        limit: int | None = None,
    ) -> pd.DataFrame:
        """Fetch rows from a database view exposed by Prisma."""

        engine = self._build_engine()
        if engine is None:
            raise RuntimeError("No database URL configured for Prisma view access")

        select_columns = ", ".join(columns) if columns else "*"
        clause = f"SELECT {select_columns} FROM {view_name}"
        if where_clause:
            clause = f"{clause} WHERE {where_clause}"
        if limit:
            clause = f"{clause} LIMIT {int(limit)}"

        LOGGER.info("Executing view query: %s", clause)
        with engine.connect() as connection:
            result = connection.execute(text(clause), params or {})
            data = result.fetchall()
            frame = pd.DataFrame(data, columns=result.keys())
            LOGGER.debug("Fetched %s rows from %s", len(frame), view_name)
            return frame

    def fetch_api(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> pd.DataFrame:
        """Fetch records from a Prisma-backed API."""

        if not self.config.api_base_url:
            raise RuntimeError("No API base URL configured for Prisma API access")

        url = f"{self.config.api_base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        request_headers = headers.copy() if headers else {}
        if self.config.api_token:
            request_headers.setdefault("Authorization", f"Bearer {self.config.api_token}")

        LOGGER.info("Requesting %s", url)
        response = requests.get(url, params=params, headers=request_headers, timeout=30)
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, list):
            data = payload
        elif isinstance(payload, dict):
            data = payload.get("data") or payload.get("items") or [payload]
        else:
            raise ValueError(f"Unexpected response type: {type(payload)!r}")

        frame = pd.DataFrame(data)
        LOGGER.debug("Fetched %s rows from %s", len(frame), url)
        return frame

    def write_metadata_snapshot(self, dataset_name: str, frame: pd.DataFrame) -> dict[str, Any]:
        """Return summary metadata for downstream documentation."""

        summary = {
            "dataset": dataset_name,
            "row_count": int(frame.shape[0]),
            "column_count": int(frame.shape[1]),
            "columns": [
                {
                    "name": column,
                    "dtype": str(frame[column].dtype),
                    "null_fraction": float(frame[column].isna().mean()),
                }
                for column in frame.columns
            ],
        }
        LOGGER.debug("Dataset %s summary: %s", dataset_name, json.dumps(summary, indent=2))
        return summary


__all__ = ["PrismaDataSource"]
