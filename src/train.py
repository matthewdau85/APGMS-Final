#!/usr/bin/env python
"""Train the APGMS question/answer matching model."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

import utils

DATA_DIR = Path("data")
DEFAULT_THRESHOLD = 0.58


def read_dataset(path: Path, synonyms) -> Tuple[List[str], List[int]]:
    texts: List[str] = []
    labels: List[int] = []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            question = row.get("question") or row.get("question_variant") or ""
            answer = row["answer"]
            label = int(row["label"])
            text = utils.combine_question_answer(question, answer, synonyms)
            texts.append(text)
            labels.append(label)
    return texts, labels


def build_pipeline() -> Pipeline:
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.9,
        lowercase=False,
        norm="l2",
        sublinear_tf=True,
    )
    classifier = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        random_state=utils._RANDOM_SEED,
    )
    return Pipeline([("vectorizer", vectorizer), ("clf", classifier)])


def select_threshold(probabilities: np.ndarray, labels: Sequence[int]) -> float:
    thresholds = np.unique(probabilities)
    if len(thresholds) == 1:
        return float(thresholds[0])
    best_threshold = 0.5
    best_score = -1.0
    for threshold in thresholds:
        preds = (probabilities >= threshold).astype(int)
        score = f1_score(labels, preds)
        if score > best_score or (score == best_score and threshold < best_threshold):
            best_threshold = float(threshold)
            best_score = float(score)
    return best_threshold


def compute_metrics(probabilities: np.ndarray, labels: Sequence[int], threshold: float) -> Dict[str, float]:
    auc = roc_auc_score(labels, probabilities)
    preds = (probabilities >= threshold).astype(int)
    acc = accuracy_score(labels, preds)
    f1 = f1_score(labels, preds)
    pos_rate = float(np.mean(labels))
    return {
        "auc": float(auc),
        "accuracy": float(acc),
        "f1": float(f1),
        "pos_rate": pos_rate,
    }


def predict_probabilities(model: Pipeline, texts: List[str], temperature: float) -> np.ndarray:
    if hasattr(model, "decision_function"):
        decisions = model.decision_function(texts)
    else:
        probs = model.predict_proba(texts)
        epsilon = 1e-9
        odds = probs[:, 1] / np.maximum(probs[:, 0], epsilon)
        decisions = np.log(odds)
    decisions = np.asarray(decisions)
    scaled = decisions * temperature
    return 1.0 / (1.0 + np.exp(-scaled))


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train APGMS matcher")
    parser.add_argument("--out", required=True, help="Path to write model joblib")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--train", default=str(DATA_DIR / "apgms_train.tsv"))
    parser.add_argument("--val", default=str(DATA_DIR / "apgms_val.tsv"))
    args = parser.parse_args(argv)

    utils.set_global_seed()
    synonyms = utils.load_synonyms()

    train_texts, train_labels = read_dataset(Path(args.train), synonyms)
    val_texts, val_labels = read_dataset(Path(args.val), synonyms)

    pipeline = build_pipeline()
    pipeline.fit(train_texts, train_labels)

    temperature = utils.default_temperature()
    val_probs = predict_probabilities(pipeline, val_texts, temperature)
    best_threshold = select_threshold(val_probs, val_labels)
    metrics = compute_metrics(val_probs, val_labels, threshold=best_threshold)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "model": pipeline,
        "threshold": float(args.threshold),
        "synonyms": synonyms,
        "temperature": temperature,
    }
    utils.dump_bundle(payload, out_path)

    metrics_path = out_path.with_name("model_metrics.json")
    metrics_payload = {
        "train_examples": len(train_texts),
        "val_examples": len(val_texts),
        "val_metrics": metrics,
        "val_threshold_f1_opt": best_threshold,
        "baked_threshold": float(args.threshold),
        "temperature": temperature,
    }
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2, sort_keys=True)

    print(json.dumps(metrics_payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
