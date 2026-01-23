# AGENTS.md (APGMS / ClearCompliance)

You are Codex operating in this repository. Your job is to implement minimal, correct changes that:
- Improve and test the prototype (code + tests + readiness).
- Prevent backend/frontend contract drift.
- Produce regulator-grade documentation and evidence artefacts aligned to DSP/OSF expectations.

## Non-negotiables
- Minimal, surgical edits only. No big refactors unless required for correctness.
- Keep backend + frontend shapes in sync (routes, schemas, error formats).
- Use ASCII only in new/edited text files.
- Provide full file contents for every file you create or change (no diffs in output).
- Every change must include:
  1) What requirement(s) it satisfies (reference docs/agent/10-product-requirements.md IDs).
  2) Tests added/updated.
  3) Run commands and expected results.
  4) Any DSP/OSF evidence mapping updates where relevant.

## Authoritative context
Read these first:
- docs/agent/00-brief.md
- docs/agent/10-product-requirements.md
- docs/agent/20-acceptance-tests.md
- docs/agent/30-repo-conventions.md
- docs/agent/40-dsp-osf.md
- docs/agent/50-current-objectives.md

## Inputs (kept in repo for grounding)
These are authoritative requirement sources and must be treated as ground truth:
- docs/agent/sources/Patent.docx
- docs/agent/sources/combined-code-export.txt

If they are missing, ask the user to copy them in.

## Standard workflow
When asked to "make the changes":
1) Identify failing tests, contract drift, or readiness reds.
2) Implement smallest fix.
3) Run: scripts/agent/run-agent-suite.sh
4) Update docs/agent/* and any DSP/OSF docs when relevant.
5) Summarize outcomes and next actions.

## Approval posture
Prefer safe operation:
- Suggest or Auto-Edit mode for code changes.
- Full-Auto only if explicitly requested.
