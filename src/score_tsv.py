#!/usr/bin/env python
"""Batch scoring utility for APGMS question/answer pairs."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Dict, List, Optional

import utils


PROFILE_THRESHOLDS = utils.DEFAULT_PROFILE_THRESHOLDS


def read_rows(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return list(reader)


def score_rows(rows: List[Dict[str, str]], bundle: utils.ModelBundle) -> List[Dict[str, str]]:
    scored: List[Dict[str, str]] = []
    for row in rows:
        question = row.get("question") or row.get("question_variant") or ""
        answer = row.get("answer") or ""
        score = utils.score_pair(question, answer, bundle)
        record = dict(row)
        record["score"] = score
        scored.append(record)
    return scored


def compute_metrics(rows: List[Dict[str, str]], threshold: float) -> Dict[str, float]:
    gold: List[int] = []
    preds: List[int] = []
    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

    scores: List[float] = []
    for row in rows:
        if "label" not in row or row["label"] in ("", None):
            continue
        label = int(row["label"])
        decision = 1 if float(row["score"]) >= threshold else 0
        scores.append(float(row["score"]))
        gold.append(label)
        preds.append(decision)
    if not gold:
        return {}
    return {
        "accuracy": float(accuracy_score(gold, preds)),
        "precision": float(precision_score(gold, preds, zero_division=0)),
        "recall": float(recall_score(gold, preds, zero_division=0)),
        "f1": float(f1_score(gold, preds, zero_division=0)),
    }


def threshold_sweep(rows: List[Dict[str, str]]) -> Dict[str, float]:
    sweep: Dict[str, float] = {}
    if not rows or "label" not in rows[0]:
        return sweep
    scores = [float(row["score"]) for row in rows]
    labels = [int(row["label"]) for row in rows]
    import numpy as np
    from sklearn.metrics import f1_score

    thresholds = [round(t / 100, 2) for t in range(50, 66)]
    for threshold in thresholds:
        preds = [1 if score >= threshold else 0 for score in scores]
        sweep[f"{threshold:.2f}"] = float(f1_score(labels, preds, zero_division=0))
    return sweep


def write_tsv(path: Path, rows: List[Dict[str, str]]) -> None:
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, delimiter="\t", fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Score TSV with APGMS model")
    parser.add_argument("model", help="Path to model bundle")
    parser.add_argument("input", help="TSV input path")
    parser.add_argument("--out", help="Write scored TSV to this path")
    parser.add_argument("--metrics-out", help="Write metrics JSON if labels available")
    parser.add_argument("--sweep-out", help="Write threshold sweep JSON")
    parser.add_argument("--profile", choices=sorted(PROFILE_THRESHOLDS.keys()))
    args = parser.parse_args(argv)

    bundle = utils.load_bundle(Path(args.model))
    rows = read_rows(Path(args.input))
    scored = score_rows(rows, bundle)
    threshold = utils.resolve_threshold(bundle, profile=args.profile)

    for row in scored:
        row["decision"] = "keep" if float(row["score"]) >= threshold else "drop"

    if args.out:
        write_tsv(Path(args.out), scored)

    if args.metrics_out:
        metrics = compute_metrics(scored, threshold)
        with Path(args.metrics_out).open("w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2, sort_keys=True)

    if args.sweep_out:
        sweep = threshold_sweep(scored)
        with Path(args.sweep_out).open("w", encoding="utf-8") as f:
            json.dump(sweep, f, indent=2, sort_keys=True)

    print(json.dumps({"threshold": threshold}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
