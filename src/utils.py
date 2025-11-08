"""Utility helpers for the APGMS matching model."""
from __future__ import annotations

import json
import os
import pickle
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Mapping, Sequence

import numpy as np
import unicodedata

try:  # Prefer joblib when available for compatibility.
    import joblib  # type: ignore
except ImportError:  # pragma: no cover - fallback path
    joblib = None

DEFAULT_PROFILE_THRESHOLDS = {
    "batch": 0.58,
    "nl": 0.61,
}

_DEFAULT_TEMPERATURE = 1.2

_RANDOM_SEED = 1337


def set_global_seed(seed: int = _RANDOM_SEED) -> None:
    """Set deterministic seeds for numpy and python random."""
    random.seed(seed)
    np.random.seed(seed)


@dataclass(frozen=True)
class ModelBundle:
    model: object
    threshold: float
    synonyms: Mapping[str, str]
    temperature: float


def _dump(payload, path: Path) -> None:
    if joblib is not None:
        joblib.dump(payload, path)
    else:
        with path.open("wb") as fh:
            pickle.dump(payload, fh)


def _load(path: Path):
    if joblib is not None:
        return joblib.load(path)
    with path.open("rb") as fh:
        return pickle.load(fh)


def load_synonyms(path: Path | None = None) -> Mapping[str, str]:
    if path is None:
        path = Path(__file__).with_name("synonyms.json")
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return {k: data[k] for k in sorted(data.keys())}


def load_bundle(model_path: Path) -> ModelBundle:
    payload = _load(model_path)
    model = payload["model"]
    threshold = float(payload.get("threshold", DEFAULT_PROFILE_THRESHOLDS["batch"]))
    synonyms = payload.get("synonyms") or load_synonyms()
    temperature = float(payload.get("temperature", _DEFAULT_TEMPERATURE))
    return ModelBundle(model=model, threshold=threshold, synonyms=synonyms, temperature=temperature)


def dump_bundle(payload, path: Path) -> None:
    _dump(payload, path)


def normalize_text(text: str, synonyms: Mapping[str, str]) -> str:
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    normalized = unicodedata.normalize("NFKC", text).lower()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return normalized

    replacements: List[tuple[str, str]] = sorted(
        synonyms.items(), key=lambda item: (-len(item[0]), item[0])
    )
    for source, target in replacements:
        if not source:
            continue
        pattern = re.compile(rf"(?<!\w){re.escape(source)}(?!\w)")
        normalized = pattern.sub(target, normalized)
    return normalized


def combine_question_answer(question: str, answer: str, synonyms: Mapping[str, str]) -> str:
    q_norm = normalize_text(question, synonyms)
    a_norm = normalize_text(answer, synonyms)
    q_tokens = [f"q__{token}" for token in q_norm.split() if token]
    a_tokens = [f"a__{token}" for token in a_norm.split() if token]
    pair_tokens = [
        f"qa__{q_token[3:]}__{a_token[3:]}" for q_token in q_tokens for a_token in a_tokens
    ]
    combined = q_tokens + ["sep_marker"] + a_tokens + pair_tokens
    return " ".join(combined)


def _decision_function(model, text: str) -> float:
    if hasattr(model, "decision_function"):
        decision = model.decision_function([text])
        if isinstance(decision, (list, tuple, np.ndarray)):
            return float(decision[0])
        return float(decision)
    probabilities = model.predict_proba([text])[0]
    # avoid division by zero
    epsilon = 1e-9
    odds = probabilities[1] / max(probabilities[0], epsilon)
    return float(np.log(odds))


def _logistic(x: float) -> float:
    return float(1.0 / (1.0 + np.exp(-x)))


def score_pair(
    question: str,
    answer: str,
    bundle: ModelBundle,
) -> float:
    text = combine_question_answer(question, answer, bundle.synonyms)
    decision = _decision_function(bundle.model, text)
    temperature_scaled = decision * bundle.temperature
    return _logistic(temperature_scaled)


def resolve_threshold(
    bundle: ModelBundle,
    profile: str | None = None,
) -> float:
    env_override = os.getenv("MATCH_THRESHOLD")
    if env_override:
        try:
            return float(env_override)
        except ValueError as exc:  # pragma: no cover - defensive
            raise ValueError(
                f"Invalid MATCH_THRESHOLD value '{env_override}'. Expected float."
            ) from exc
    if profile and profile in DEFAULT_PROFILE_THRESHOLDS:
        return DEFAULT_PROFILE_THRESHOLDS[profile]
    return bundle.threshold


def batched(iterable: Sequence, size: int) -> Iterable[Sequence]:
    for start in range(0, len(iterable), size):
        yield iterable[start : start + size]


def default_temperature() -> float:
    return _DEFAULT_TEMPERATURE
