"""APGMS ML Core package.

Provides feature pipeline orchestration, fairness and explainability tooling,
and dataset materialisation helpers that align with DSP evidence requirements.
"""

from .pipelines import ComplianceFeaturePipeline, FeaturePipelineConfig
from .reporting import generate_model_report, generate_shap_summary

__all__ = [
    "ComplianceFeaturePipeline",
    "FeaturePipelineConfig",
    "generate_model_report",
    "generate_shap_summary",
]
