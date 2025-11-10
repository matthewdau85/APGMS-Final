"""Feature builders that hydrate datasets from the transactional ledger."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Iterable, Sequence

import numpy as np
import pandas as pd
from prisma import Prisma

from ..artifacts import write_dataframe


@dataclass(slots=True)
class FeatureArtifact:
    """Metadata describing a stored artifact."""

    name: str
    paths: dict[str, str]
    rows: int
    columns: Sequence[str]


class FeatureBuilder:
    """Builds machine learning features using Prisma as the storage backend."""

    def __init__(self, prisma: Prisma | None = None, *, auto_connect: bool = True):
        self._prisma = prisma or Prisma()
        self._auto_connect = auto_connect
        self._lock = asyncio.Lock()

    async def _ensure_connection(self) -> Prisma:
        if self._prisma.is_connected():
            return self._prisma
        if not self._auto_connect:
            msg = "Prisma client is not connected and auto_connect is disabled"
            raise RuntimeError(msg)
        async with self._lock:
            if not self._prisma.is_connected():
                await self._prisma.connect()
        return self._prisma

    async def build_ledger_history(self, org_id: str, *, lookback_days: int = 180) -> FeatureArtifact:
        """Aggregate journal + posting history for an organisation."""

        prisma = await self._ensure_connection()
        since = datetime.utcnow() - timedelta(days=lookback_days)
        journals = await prisma.journal.find_many(
            where={
                "orgId": org_id,
                "occurredAt": {"gte": since},
            },
            include={
                "postings": {
                    "include": {
                        "account": True,
                    }
                }
            },
            order={"occurredAt": "asc"},
        )

        columns = [
            "journal_id",
            "occurred_at",
            "account_code",
            "account_name",
            "amount_cents",
            "memo",
            "journal_type",
            "source",
        ]
        rows: list[dict[str, Any]] = []
        for journal in journals:
            for posting in journal.postings:
                account = posting.account
                rows.append(
                    {
                        "journal_id": journal.id,
                        "occurred_at": journal.occurred_at,
                        "account_code": account.code if account else None,
                        "account_name": account.name if account else None,
                        "amount_cents": int(posting.amount_cents),
                        "memo": posting.memo,
                        "journal_type": journal.type,
                        "source": journal.source,
                    }
                )

        df = pd.DataFrame(rows, columns=columns)
        if not df.empty:
            df["amount"] = df["amount_cents"].astype(np.int64) / 100.0
            df["occurred_at"] = pd.to_datetime(df["occurred_at"], utc=True)
            columns.append("amount")
            df = df[columns]

        paths = write_dataframe(df, f"ledger_history_{org_id}")
        return FeatureArtifact(
            name="ledger_history",
            paths={k: str(v) for k, v in paths.items()},
            rows=len(df),
            columns=list(df.columns),
        )

    async def build_payroll_punctuality(self, org_id: str, *, lookback_days: int = 365) -> FeatureArtifact:
        """Compute payroll punctuality metrics based on PayRun and Payslip data."""

        prisma = await self._ensure_connection()
        since = datetime.utcnow() - timedelta(days=lookback_days)
        pay_runs = await prisma.payrun.find_many(
            where={
                "orgId": org_id,
                "periodStart": {"gte": since},
            },
            include={"payslips": True},
            order={"periodStart": "asc"},
        )

        columns = [
            "pay_run_id",
            "period_start",
            "period_end",
            "payment_date",
            "cycle_days",
            "days_late",
            "payslip_count",
            "total_gross",
            "estimated_net",
            "status",
        ]
        rows: list[dict[str, Any]] = []
        for run in pay_runs:
            duration = (
                (run.period_end - run.period_start).days if run.period_end and run.period_start else None
            )
            lateness = (
                (run.payment_date - run.period_end).days if run.payment_date and run.period_end else None
            )
            total_gross = sum(float(slip.gross_pay) for slip in run.payslips)
            total_net = total_gross - sum(float(slip.payg_withheld) for slip in run.payslips)
            rows.append(
                {
                    "pay_run_id": run.id,
                    "period_start": run.period_start,
                    "period_end": run.period_end,
                    "payment_date": run.payment_date,
                    "cycle_days": duration,
                    "days_late": lateness,
                    "payslip_count": len(run.payslips),
                    "total_gross": total_gross,
                    "estimated_net": total_net,
                    "status": run.status,
                }
            )

        df = pd.DataFrame(rows, columns=columns)
        if not df.empty:
            for column in ("period_start", "period_end", "payment_date"):
                df[column] = pd.to_datetime(df[column], utc=True)

        paths = write_dataframe(df, f"payroll_punctuality_{org_id}")
        return FeatureArtifact(
            name="payroll_punctuality",
            paths={k: str(v) for k, v in paths.items()},
            rows=len(df),
            columns=list(df.columns),
        )

    async def build_discrepancy_outcomes(
        self,
        org_id: str,
        *,
        lookback_days: int = 365,
        active_statuses: Iterable[str] = ("OPEN", "UNDER_REVIEW"),
    ) -> FeatureArtifact:
        """Summarise reconciliation alert outcomes for model training."""

        prisma = await self._ensure_connection()
        since = datetime.utcnow() - timedelta(days=lookback_days)
        alerts = await prisma.reconciliationalert.find_many(
            where={
                "orgId": org_id,
                "openedAt": {"gte": since},
            },
            order={"openedAt": "asc"},
        )

        columns = [
            "alert_id",
            "opened_at",
            "resolved_at",
            "status",
            "is_active",
            "resolution_hours",
            "kind",
        ]
        active = set(active_statuses)
        rows: list[dict[str, Any]] = []
        for alert in alerts:
            open_duration = (
                (alert.resolved_at - alert.opened_at).total_seconds() / 3600
                if alert.resolved_at and alert.opened_at
                else None
            )
            rows.append(
                {
                    "alert_id": alert.id,
                    "opened_at": alert.opened_at,
                    "resolved_at": alert.resolved_at,
                    "status": alert.status,
                    "is_active": alert.status in active,
                    "resolution_hours": open_duration,
                    "kind": alert.kind,
                }
            )

        df = pd.DataFrame(rows, columns=columns)
        if not df.empty:
            for column in ("opened_at", "resolved_at"):
                df[column] = pd.to_datetime(df[column], utc=True)
            df["is_active"] = df["is_active"].astype(bool)

        paths = write_dataframe(df, f"discrepancy_outcomes_{org_id}")
        return FeatureArtifact(
            name="discrepancy_outcomes",
            paths={k: str(v) for k, v in paths.items()},
            rows=len(df),
            columns=list(df.columns),
        )

    async def close(self) -> None:
        if self._prisma.is_connected():
            await self._prisma.disconnect()


__all__ = ["FeatureBuilder", "FeatureArtifact"]
