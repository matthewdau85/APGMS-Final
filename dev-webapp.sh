#!/usr/bin/env bash
set -e
set -u
set -o pipefail

cd "$(dirname "$0")"
cd webapp

pnpm install --frozen-lockfile
pnpm dev -- --host 0.0.0.0 --port 5173
