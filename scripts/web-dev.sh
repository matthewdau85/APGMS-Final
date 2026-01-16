#!/usr/bin/env bash
# APGMS: start webapp only
set -Eeuo pipefail 2>/dev/null || set -Eeuo
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/webapp"
exec pnpm dev -- --host 0.0.0.0 --port 5173 --strictPort
