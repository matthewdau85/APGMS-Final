#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Prisma schema validation"
pnpm exec prisma validate --schema infra/prisma/schema.prisma
