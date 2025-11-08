"""Public API for scoring APGMS question/answer pairs."""
from __future__ import annotations

import functools
from pathlib import Path
from typing import Mapping, Optional

import utils

_DEFAULT_MODEL_PATH = Path(__file__).with_name("model.joblib")


@functools.lru_cache(maxsize=1)
def _load_default_bundle() -> utils.ModelBundle:
    if not _DEFAULT_MODEL_PATH.exists():
        raise FileNotFoundError(
            "Default model.joblib not found. Provide --model argument or place the bundle "
            "next to app.py."
        )
    return utils.load_bundle(_DEFAULT_MODEL_PATH)


def get_bundle(model_path: Optional[str] = None) -> utils.ModelBundle:
    if model_path:
        return utils.load_bundle(Path(model_path))
    return _load_default_bundle()


def score_query_answer(question: str, answer: str, model_path: Optional[str] = None) -> float:
    """Return the probability that the answer matches the question."""
    bundle = get_bundle(model_path)
    return utils.score_pair(question, answer, bundle)


def normalize_text(text: str, synonyms: Optional[Mapping[str, str]] = None) -> str:
    if synonyms is None:
        try:
            synonyms = get_bundle().synonyms
        except FileNotFoundError:
            synonyms = utils.load_synonyms()
    return utils.normalize_text(text, synonyms)


def get_threshold(profile: Optional[str] = None, model_path: Optional[str] = None) -> float:
    bundle = get_bundle(model_path)
    return utils.resolve_threshold(bundle, profile=profile)


def get_synonyms(model_path: Optional[str] = None) -> Mapping[str, str]:
    if model_path:
        return utils.load_bundle(Path(model_path)).synonyms
    try:
        return get_bundle().synonyms
    except FileNotFoundError:
        return utils.load_synonyms()

