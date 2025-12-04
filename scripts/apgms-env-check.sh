#!/usr/bin/env bash
set -e

echo "=== OS ==="
uname -a
echo

echo "=== Node & PNPM ==="
if command -v node >/dev/null 2>&1; then
  echo -n "node: "
  node -v
else
  echo "node: NOT FOUND"
fi

if command -v corepack >/dev/null 2>&1; then
  echo -n "corepack: "
  corepack --version || echo "corepack present but failed to report version"
else
  echo "corepack: NOT FOUND"
fi

if command -v pnpm >/dev/null 2>&1; then
  echo -n "pnpm: "
  pnpm -v
else
  echo "pnpm: NOT FOUND"
fi
echo

echo "=== NPM (optional) ==="
if command -v npm >/dev/null 2>&1; then
  echo -n "npm: "
  npm -v
else
  echo "npm: NOT FOUND"
fi
echo

echo "=== Docker ==="
if command -v docker >/dev/null 2>&1; then
  docker --version || echo "docker present but failed to report version"
  docker compose version || echo "docker compose subcommand not available"
else
  echo "docker: NOT FOUND"
fi
echo

echo "=== PostgreSQL via Docker (apgms-postgres) ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --filter "name=apgms-postgres" --format "table {{.Names}}\t{{.Status}}" || echo "no apgms-postgres container running"
else
  echo "docker not available; cannot check container"
fi
echo

echo "=== psql client (optional) ==="
if command -v psql >/dev/null 2>&1; then
  echo -n "psql: "
  psql --version
else
  echo "psql: NOT FOUND"
fi
echo

echo "=== Playwright (via pnpm) ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec playwright --version 2>/dev/null || echo "Playwright CLI not installed or not available via pnpm"
else
  echo "pnpm not available; cannot check Playwright"
fi
echo

echo "=== Current directory ==="
pwd
