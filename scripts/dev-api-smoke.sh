#!/usr/bin/env bash
set -euo pipefail
base="${1:-http://127.0.0.1:3000}"
echo "[smoke] GET $base/ready"
curl -fsS -i "$base/ready" || { echo "[smoke] /ready failed"; exit 2; }
echo
# Add optional probes here as routes mature, e.g. /metrics or /version
exit 0
