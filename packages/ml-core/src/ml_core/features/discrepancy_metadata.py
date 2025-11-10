"""Discrepancy and alert metadata features."""

from __future__ import annotations

import pandas as pd

from .base import FeatureConfig, QueryExecutor, _default_params

DISCREPANCY_QUERY = """
SELECT
    'reconciliation'::text AS source,
    ra."kind"             AS category,
    ra."status"           AS status,
    ra."openedAt"         AS opened_at,
    ra."resolvedAt"       AS resolved_at
FROM "ReconciliationAlert" AS ra
WHERE ra."orgId" = %(org_id)s
  AND ra."openedAt" BETWEEN (%(as_of)s - INTERVAL '%(lookback_days)s days') AND %(as_of)s
UNION ALL
SELECT
    'operations'::text AS source,
    a."type"          AS category,
    CASE WHEN a."resolvedAt" IS NULL THEN 'OPEN' ELSE 'CLOSED' END AS status,
    a."createdAt"     AS opened_at,
    a."resolvedAt"    AS resolved_at
FROM "Alert" AS a
WHERE a."orgId" = %(org_id)s
  AND a."createdAt" BETWEEN (%(as_of)s - INTERVAL '%(lookback_days)s days') AND %(as_of)s;
"""


def discrepancy_metadata_features(executor: QueryExecutor, config: FeatureConfig) -> pd.DataFrame:
    """Aggregate reconciliation and alert signals."""

    frame = executor.fetch_dataframe(DISCREPANCY_QUERY, params=_default_params(config))
    if frame.empty:
        return pd.DataFrame(
            [
                {
                    "org_id": config.org_id,
                    "open_discrepancy_count": 0.0,
                    "avg_resolution_hours": 0.0,
                    "reconciliation_alert_ratio": 0.0,
                }
            ]
        )

    frame["opened_at"] = pd.to_datetime(frame["opened_at"])
    frame["resolved_at"] = pd.to_datetime(frame["resolved_at"])

    open_count = (frame["status"].str.upper() == "OPEN").sum()
    closed = frame[frame["status"].str.upper() != "OPEN"].copy()
    if not closed.empty:
        closed["resolution_hours"] = (
            (closed["resolved_at"] - closed["opened_at"]).dt.total_seconds() / 3600.0
        )
        avg_resolution_hours = float(closed["resolution_hours"].mean())
    else:
        avg_resolution_hours = 0.0

    reconciliation_ratio = float(
        (frame["source"] == "reconciliation").sum() / len(frame)
    ) if len(frame) else 0.0

    return pd.DataFrame(
        [
            {
                "org_id": config.org_id,
                "open_discrepancy_count": float(open_count),
                "avg_resolution_hours": avg_resolution_hours,
                "reconciliation_alert_ratio": reconciliation_ratio,
            }
        ]
    )


__all__ = ["discrepancy_metadata_features", "DISCREPANCY_QUERY"]
