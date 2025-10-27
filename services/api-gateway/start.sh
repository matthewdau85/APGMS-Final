#!/bin/sh
set -e

echo "[api-gateway] waiting for postgres at db:5432 ..."

# simple wait loop
until nc -z db 5432; do
  echo "[api-gateway] postgres not ready yet, retrying..."
  sleep 1
done

echo "[api-gateway] postgres is up, starting Fastify..."
node dist/index.js
