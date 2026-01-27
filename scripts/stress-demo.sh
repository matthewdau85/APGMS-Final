#!/usr/bin/env bash
set -e

curl -X POST http://localhost:3000/admin/demo/reset-and-seed

for i in {1..100}; do
  curl -s http://localhost:3000/bas/preview > /dev/null
done

curl -X POST http://localhost:3000/compliance/evidence

echo "STRESS OK"
