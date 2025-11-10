"""Command line entrypoints for feature generation."""

from __future__ import annotations

import argparse
import asyncio

from prisma import Prisma

from ..features.builder import FeatureBuilder


async def _run(builder: FeatureBuilder, org_id: str) -> None:
    results = await asyncio.gather(
        builder.build_ledger_history(org_id),
        builder.build_payroll_punctuality(org_id),
        builder.build_discrepancy_outcomes(org_id),
    )
    for artifact in results:
        print(f"{artifact.name}: {artifact.rows} rows -> {artifact.paths}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build ML feature tables from Prisma data")
    parser.add_argument("org_id", help="Organisation identifier to hydrate features for")
    parser.add_argument("--no-auto-connect", action="store_true", help="Do not auto-connect the Prisma client")
    args = parser.parse_args(argv)

    client = Prisma()
    builder = FeatureBuilder(client, auto_connect=not args.no_auto_connect)

    try:
        asyncio.run(_run(builder, args.org_id))
    finally:
        asyncio.run(builder.close())

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
