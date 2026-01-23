# Repo Conventions for Codex

## Change policy
- Small, testable changes only.
- Do not reformat unrelated files.
- Do not touch backup/export folders unless explicitly asked.

## Output policy
When you propose changes, always provide:
- Full contents of each changed/new file (not diffs).
- Exact commands to run in WSL.
- Expected outputs / what "green" looks like.

## Contract sync policy
- Any backend route change requires a corresponding frontend client update.
- Validation rules must stay consistent across layers.
