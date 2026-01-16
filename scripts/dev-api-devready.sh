#!/usr/bin/env bash
set -euo pipefail
( fuser -k 3000/tcp 2>/dev/null || true; \
  lsof -ti :3000 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//' | xargs -r kill -9 || true )
export DEV_READY_ALWAYS=1
cd "$(dirname "$0")/../services/api-gateway"
pnpm dev
