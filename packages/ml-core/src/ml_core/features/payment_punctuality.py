"""Payroll punctuality features."""

from __future__ import annotations

import pandas as pd

from .base import FeatureConfig, QueryExecutor, _default_params

PAYMENT_PUNCTUALITY_QUERY = """
SELECT
    pr."id"            AS pay_run_id,
    pr."orgId"         AS org_id,
    pr."periodStart"   AS period_start,
    pr."periodEnd"     AS period_end,
    pr."paymentDate"   AS payment_date,
    pr."status"        AS status,
    COUNT(ps."id")     AS payslip_count,
    COALESCE(SUM(ps."grossPay"), 0)::float AS gross_pay_amount
FROM "PayRun" AS pr
LEFT JOIN "Payslip" AS ps ON ps."payRunId" = pr."id"
WHERE pr."orgId" = %(org_id)s
  AND pr."paymentDate" BETWEEN (%(as_of)s - INTERVAL '%(lookback_days)s days') AND %(as_of)s
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY pr."paymentDate" DESC;
"""


def payment_punctuality_features(executor: QueryExecutor, config: FeatureConfig) -> pd.DataFrame:
    """Return aggregate punctuality metrics for payroll runs."""

    frame = executor.fetch_dataframe(PAYMENT_PUNCTUALITY_QUERY, params=_default_params(config))
    if frame.empty:
        return pd.DataFrame(
            [
                {
                    "org_id": config.org_id,
                    "avg_payment_lag_days": 0.0,
                    "late_payment_ratio": 0.0,
                    "payslip_volume": 0.0,
                    "gross_pay_total": 0.0,
                }
            ]
        )

    frame["payment_date"] = pd.to_datetime(frame["payment_date"])
    frame["period_end"] = pd.to_datetime(frame["period_end"])
    frame["lag_days"] = (frame["payment_date"] - frame["period_end"]).dt.days

    late_mask = frame["lag_days"] > 0
    total_runs = len(frame)
    late_runs = late_mask.sum()

    return pd.DataFrame(
        [
            {
                "org_id": config.org_id,
                "avg_payment_lag_days": float(frame["lag_days"].mean()),
                "late_payment_ratio": float(late_runs / total_runs) if total_runs else 0.0,
                "payslip_volume": float(frame["payslip_count"].sum()),
                "gross_pay_total": float(frame["gross_pay_amount"].sum()),
            }
        ]
    )


__all__ = ["payment_punctuality_features", "PAYMENT_PUNCTUALITY_QUERY"]
