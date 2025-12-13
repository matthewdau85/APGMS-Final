# APGMS Assessor

What this is:
- Requirements-driven readiness/correctness assessor.
- Tests act as executable specs; readiness/scans act as verification.
- Production gating for DSP/OSF uses docs/compliance/dsp-operational-framework.md.

Commands:
- pnpm assess:fast   (static only)
- pnpm assess:full   (static + typecheck + tests + readiness)
- pnpm assess:all    (full + security scans + evidence generation)

Outputs:
- reports/apgms-assess.json
- reports/apgms-assess.md

Exit codes:
- 0 = TICK (ready for selected mode gates + thresholds)
- 2 = NOT CLEAR
