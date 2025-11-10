"""Ledger history feature generation."""

from __future__ import annotations

from datetime import timedelta

import pandas as pd

from .base import FeatureConfig, QueryExecutor, _default_params

LEDGER_HISTORY_QUERY = """
WITH recent_postings AS (
    SELECT
        j."orgId"          AS org_id,
        DATE(j."occurredAt") AS occurred_date,
        p."accountId"      AS account_id,
        SUM(p."amountCents") / 100.0 AS net_amount_aud,
        COUNT(*)            AS posting_count
    FROM "Posting" AS p
    INNER JOIN "Journal" AS j ON j."id" = p."journalId"
    WHERE j."orgId" = %(org_id)s
      AND j."occurredAt" BETWEEN (%(as_of)s - INTERVAL '%(lookback_days)s days') AND %(as_of)s
    GROUP BY 1, 2, 3
)
SELECT
    org_id,
    occurred_date,
    account_id,
    net_amount_aud,
    posting_count
FROM recent_postings
ORDER BY occurred_date DESC;
"""


WINDOWS = (30, 90, 180)


def ledger_history_features(executor: QueryExecutor, config: FeatureConfig) -> pd.DataFrame:
    """Aggregate ledger movement statistics for the configured organisation."""

    frame = executor.fetch_dataframe(LEDGER_HISTORY_QUERY, params=_default_params(config))
    if frame.empty:
        return _empty_frame(config.org_id)

    frame["occurred_date"] = pd.to_datetime(frame["occurred_date"])
    frame["abs_amount_aud"] = frame["net_amount_aud"].abs()

    feature_data: dict[str, float] = {"org_id": config.org_id}
    for window in WINDOWS:
        summary = _summarise_window(frame, config, window)
        feature_data.update(summary)

    return pd.DataFrame([feature_data])


def _summarise_window(frame: pd.DataFrame, config: FeatureConfig, window: int) -> dict[str, float]:
    cutoff = pd.Timestamp(config.as_of_date - timedelta(days=window))
    window_frame = frame[frame["occurred_date"] >= cutoff]

    if window_frame.empty:
        return {
            f"ledger_net_amount_{window}d": 0.0,
            f"ledger_abs_amount_{window}d": 0.0,
            f"ledger_posting_count_{window}d": 0.0,
        }

    return {
        f"ledger_net_amount_{window}d": window_frame["net_amount_aud"].sum(),
        f"ledger_abs_amount_{window}d": window_frame["abs_amount_aud"].sum(),
        f"ledger_posting_count_{window}d": float(window_frame["posting_count"].sum()),
    }


def _empty_frame(org_id: str) -> pd.DataFrame:
    payload = {"org_id": org_id}
    for window in WINDOWS:
        payload.update(
            {
                f"ledger_net_amount_{window}d": 0.0,
                f"ledger_abs_amount_{window}d": 0.0,
                f"ledger_posting_count_{window}d": 0.0,
            }
        )
    return pd.DataFrame([payload])


__all__ = ["ledger_history_features", "LEDGER_HISTORY_QUERY"]
