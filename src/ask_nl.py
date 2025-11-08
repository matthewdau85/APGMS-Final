#!/usr/bin/env python
"""Interactive NL probing tool for APGMS model."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import utils


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Interactive NL probe")
    parser.add_argument("--model", required=True, help="Path to model bundle")
    parser.add_argument("--profile", choices=sorted(utils.DEFAULT_PROFILE_THRESHOLDS.keys()), default="nl")
    args = parser.parse_args(argv)

    bundle = utils.load_bundle(Path(args.model))
    threshold = utils.resolve_threshold(bundle, profile=args.profile)

    print("Type 'exit' to quit.")
    while True:
        try:
            question = input("Q> ").strip()
        except EOFError:
            break
        if not question or question.lower() == "exit":
            break
        answer = input("A> ").strip()
        if answer.lower() == "exit":
            break
        score = utils.score_pair(question, answer, bundle)
        decision = "KEEP" if score >= threshold else "DROP"
        print(json.dumps({
            "score": score,
            "threshold": threshold,
            "decision": decision,
        }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
