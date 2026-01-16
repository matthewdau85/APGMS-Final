#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export REGWATCH_HOST="${REGWATCH_HOST:-127.0.0.1}"
export REGWATCH_PORT="${REGWATCH_PORT:-3030}"
pnpm --filter @apgms/regwatcher dev
