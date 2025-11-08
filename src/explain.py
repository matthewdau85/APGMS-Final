#!/usr/bin/env python
"""Explain feature contributions for an APGMS model decision."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

import utils


def describe_contributions(vectorizer, clf, text: str, top: int) -> dict:
    feature_names = vectorizer.get_feature_names_out()
    vector = vectorizer.transform([text])
    weights = clf.coef_[0]
    contributions = vector.multiply(weights)
    dense = contributions.toarray()[0]

    top_pos_idx = np.argsort(dense)[::-1][:top]
    top_neg_idx = np.argsort(dense)[:top]

    def gather(indices):
        result = []
        for idx in indices:
            value = float(dense[idx])
            if value == 0.0:
                continue
            result.append({
                "feature": feature_names[idx],
                "weight": float(weights[idx]),
                "contribution": value,
            })
        return result

    return {
        "positive": gather(top_pos_idx),
        "negative": gather(top_neg_idx),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Explain APGMS model decision")
    parser.add_argument("--model", required=True, help="Path to model bundle")
    parser.add_argument("--q", required=True, help="Question text")
    parser.add_argument("--a", required=True, help="Answer text")
    parser.add_argument("--top", type=int, default=10, help="Number of features to show")
    args = parser.parse_args(argv)

    bundle = utils.load_bundle(Path(args.model))
    pipeline = bundle.model
    vectorizer = pipeline.named_steps["vectorizer"]
    clf = pipeline.named_steps["clf"]

    text = utils.combine_question_answer(args.q, args.a, bundle.synonyms)
    score = utils.score_pair(args.q, args.a, bundle)

    explanation = describe_contributions(vectorizer, clf, text, args.top)
    payload = {
        "question": args.q,
        "answer": args.a,
        "score": score,
        "threshold": utils.resolve_threshold(bundle),
        "explanation": explanation,
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
