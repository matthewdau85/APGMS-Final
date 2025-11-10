"""Database-backed feature pipelines for APGMS risk models.

The module exposes composable coroutine helpers that query the primary
PostgreSQL database through Prisma. Each helper focuses on a domain slice
(ledger history, payment punctuality, discrepancy resolution) and the
`build_feature_vector` orchestrator merges the aggregates into a single
feature row per employer or account.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from statistics import mean
from typing import Any, Dict, Iterable, List, Mapping, Optional

from prisma import Prisma


@dataclass(slots=True)
class LedgerFeatures:
    """Aggregated ledger signals for a single account."""

    net_flow_30d: float = 0.0
    avg_credit_amount: float = 0.0
    avg_debit_amount: float = 0.0
    balance_volatility: float = 0.0
    credit_transaction_count: int = 0
    debit_transaction_count: int = 0


@dataclass(slots=True)
class PaymentPunctualityFeatures:
    """Capture payment timeliness and cadence."""

    on_time_ratio: float = 0.0
    avg_days_late: float = 0.0
    late_payment_rate_90d: float = 0.0
    scheduled_payment_count: int = 0


@dataclass(slots=True)
class DiscrepancyFeatures:
    """Summaries for the reconciliation discrepancy workflow."""

    open_discrepancy_count: int = 0
    avg_resolution_hours: float = 0.0
    high_severity_rate: float = 0.0


@dataclass(slots=True)
class FeatureVector:
    """Combined feature vector suitable for model training."""

    account_id: str
    as_of: datetime
    ledger: LedgerFeatures
    payment: PaymentPunctualityFeatures
    discrepancy: DiscrepancyFeatures

    def as_flat_dict(self) -> Dict[str, Any]:
        """Return a flattened dictionary representation.

        The flattened schema is convenient for Pandas/DataFrame construction.
        """

        payload: Dict[str, Any] = {
            "account_id": self.account_id,
            "as_of": self.as_of.isoformat(),
        }
        payload.update({f"ledger_{k}": v for k, v in asdict(self.ledger).items()})
        payload.update({f"payment_{k}": v for k, v in asdict(self.payment).items()})
        payload.update({f"discrepancy_{k}": v for k, v in asdict(self.discrepancy).items()})
        return payload


async def _query_ledger_history(
    prisma: Prisma,
    account_id: str,
    lookback_days: int,
) -> List[Mapping[str, Any]]:
    """Fetch ledger entries ordered by date descending."""

    since = datetime.utcnow() - timedelta(days=lookback_days)
    query = """
        SELECT account_id, occurred_at, amount, balance_after, direction
        FROM "LedgerEntry"
        WHERE account_id = $1
          AND occurred_at >= $2
        ORDER BY occurred_at DESC
    """
    rows: List[Mapping[str, Any]] = await prisma.query_raw(query, account_id, since)
    return rows


async def _query_payment_punctuality(
    prisma: Prisma,
    account_id: str,
    lookback_days: int,
) -> List[Mapping[str, Any]]:
    """Fetch payment schedule entries and actual payments."""

    since = datetime.utcnow() - timedelta(days=lookback_days)
    query = """
        SELECT due_date, paid_date, amount, status
        FROM "PaymentSchedule"
        WHERE account_id = $1
          AND due_date >= $2
    """
    rows: List[Mapping[str, Any]] = await prisma.query_raw(query, account_id, since)
    return rows


async def _query_discrepancies(
    prisma: Prisma,
    account_id: str,
    lookback_days: int,
) -> List[Mapping[str, Any]]:
    """Fetch discrepancy case details for the combined reconciliation tables."""

    since = datetime.utcnow() - timedelta(days=lookback_days)
    query = """
        SELECT opened_at, resolved_at, severity, status
        FROM "LedgerDiscrepancy"
        WHERE account_id = $1
          AND opened_at >= $2
        UNION ALL
        SELECT opened_at, resolved_at, severity, status
        FROM "PayrollDiscrepancy"
        WHERE account_id = $1
          AND opened_at >= $2
    """
    rows: List[Mapping[str, Any]] = await prisma.query_raw(query, account_id, since)
    return rows


def _compute_ledger_features(rows: Iterable[Mapping[str, Any]]) -> LedgerFeatures:
    rows_list = list(rows)
    credits: List[float] = []
    debits: List[float] = []
    balances: List[float] = []
    net_flow_recent = 0.0
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    for row in rows_list:
        amount = float(row.get("amount", 0) or 0)
        direction = (row.get("direction") or "").lower()
        if direction == "credit" or amount > 0:
            credits.append(abs(amount))
        else:
            debits.append(abs(amount))
        balances.append(float(row.get("balance_after", 0) or 0))

        occurred_at = row.get("occurred_at")
        if isinstance(occurred_at, datetime) and occurred_at >= thirty_days_ago:
            if direction == "credit" or amount > 0:
                net_flow_recent += abs(amount)
            else:
                net_flow_recent -= abs(amount)

    if len(balances) > 1:
        diffs = [abs(balances[i] - balances[i + 1]) for i in range(len(balances) - 1)]
        balance_volatility = mean(diffs)
    else:
        balance_volatility = 0.0

    net_flow = net_flow_recent

    return LedgerFeatures(
        net_flow_30d=net_flow,
        avg_credit_amount=mean(credits) if credits else 0.0,
        avg_debit_amount=mean(debits) if debits else 0.0,
        balance_volatility=balance_volatility,
        credit_transaction_count=len(credits),
        debit_transaction_count=len(debits),
    )


def _compute_payment_features(rows: Iterable[Mapping[str, Any]]) -> PaymentPunctualityFeatures:
    total = 0
    on_time = 0
    late_deltas: List[float] = []
    recent_late = 0

    ninety_days_ago = datetime.utcnow() - timedelta(days=90)

    for row in rows:
        total += 1
        due_date: Optional[datetime] = row.get("due_date")
        paid_date: Optional[datetime] = row.get("paid_date")
        status = (row.get("status") or "").lower()

        if paid_date and due_date:
            delta = (paid_date - due_date).days
            if delta <= 0:
                on_time += 1
            else:
                late_deltas.append(delta)
        elif status == "paid":
            on_time += 1  # treat missing timestamps as on time if completed
        else:
            late_deltas.append(5)  # placeholder penalty for missing payment

        if due_date and due_date >= ninety_days_ago and paid_date:
            if paid_date > due_date:
                recent_late += 1

    return PaymentPunctualityFeatures(
        on_time_ratio=on_time / total if total else 0.0,
        avg_days_late=mean(late_deltas) if late_deltas else 0.0,
        late_payment_rate_90d=recent_late / total if total else 0.0,
        scheduled_payment_count=total,
    )


def _compute_discrepancy_features(rows: Iterable[Mapping[str, Any]]) -> DiscrepancyFeatures:
    rows_list = list(rows)
    open_cases = 0
    resolution_hours: List[float] = []
    high_severity = 0

    for row in rows_list:
        status = (row.get("status") or "").lower()
        severity = (row.get("severity") or "").lower()
        opened_at: Optional[datetime] = row.get("opened_at")
        resolved_at: Optional[datetime] = row.get("resolved_at")

        if status in {"open", "investigating"}:
            open_cases += 1
        if severity in {"high", "critical"}:
            high_severity += 1
        if opened_at and resolved_at:
            resolution_hours.append((resolved_at - opened_at).total_seconds() / 3600)

    total_cases = len(rows_list)
    high_rate = (high_severity / total_cases) if total_cases else 0.0

    return DiscrepancyFeatures(
        open_discrepancy_count=open_cases,
        avg_resolution_hours=mean(resolution_hours) if resolution_hours else 0.0,
        high_severity_rate=high_rate,
    )


async def build_feature_vector(
    prisma: Prisma,
    account_id: str,
    *,
    ledger_lookback_days: int = 90,
    payment_lookback_days: int = 180,
    discrepancy_lookback_days: int = 180,
    as_of: Optional[datetime] = None,
) -> FeatureVector:
    """Materialise the complete feature vector for an account.

    Parameters
    ----------
    prisma:
        An instance of :class:`prisma.Prisma` connected to the operational
        database.
    account_id:
        Employer or ledger account identifier.
    ledger_lookback_days / payment_lookback_days / discrepancy_lookback_days:
        Time windows applied to each aggregation query.
    as_of:
        Explicit timestamp associated with the feature vector. Defaults to
        ``datetime.utcnow()`` when not provided.
    """

    ledger_rows = await _query_ledger_history(prisma, account_id, ledger_lookback_days)
    payment_rows = await _query_payment_punctuality(
        prisma, account_id, payment_lookback_days
    )
    discrepancy_rows = await _query_discrepancies(
        prisma, account_id, discrepancy_lookback_days
    )

    ledger_features = _compute_ledger_features(ledger_rows)
    payment_features = _compute_payment_features(payment_rows)
    discrepancy_features = _compute_discrepancy_features(discrepancy_rows)

    return FeatureVector(
        account_id=account_id,
        as_of=as_of or datetime.utcnow(),
        ledger=ledger_features,
        payment=payment_features,
        discrepancy=discrepancy_features,
    )
