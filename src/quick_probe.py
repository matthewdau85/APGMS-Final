#!/usr/bin/env python
"""Quick CLI to score a single question/answer pair."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import utils


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Probe APGMS model")
    parser.add_argument("question", help="Question text")
    parser.add_argument("answer", help="Answer text")
    parser.add_argument("--model", required=True, help="Path to model bundle")
    args = parser.parse_args(argv)

    bundle = utils.load_bundle(Path(args.model))
    score = utils.score_pair(args.question, args.answer, bundle)
    threshold = utils.resolve_threshold(bundle)
    payload = {
        "question": args.question,
        "answer": args.answer,
        "score": score,
        "threshold": threshold,
        "decision": score >= threshold,
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
