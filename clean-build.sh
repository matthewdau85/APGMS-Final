#!/usr/bin/env bash
set -euo pipefail

cd /mnt/c/src/apgms

mkdir -p logs
pnpm -r build > logs/pnpm-build.log 2>&1
echo "Build complete. See logs/pnpm-build.log"
