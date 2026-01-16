#!/usr/bin/env bash
set -euo pipefail
( fuser -k 3000/tcp 2>/dev/null || true
  lsof -ti :3000 -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//' | xargs -r kill -9 || true
  pkill -f "services/api-gateway.*tsx" 2>/dev/null || true
  pkill -f "node.*services/api-gateway" 2>/dev/null || true ) || true
echo "api-gateway: port 3000 cleared"
