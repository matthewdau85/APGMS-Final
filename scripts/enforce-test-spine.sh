#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
API="services/api-gateway"
TEST_DIR="$API/test"
HELPERS="$TEST_DIR/helpers"

echo "== APGMS Test Spine Enforcement =="

# -------------------------
# 1. Hard enforcement
# -------------------------

echo "Checking for illegal Fastify() usage..."
if grep -R "Fastify(" "$TEST_DIR" >/dev/null; then
  echo "❌ ERROR: Fastify() used directly in tests"
  exit 1
fi

echo "Checking for .listen() usage..."
if grep -R "\.listen(" "$TEST_DIR" >/dev/null; then
  echo "❌ ERROR: .listen() used in tests"
  exit 1
fi

echo "Checking for alternate app builders..."
if grep -R "buildServer" "$TEST_DIR" >/dev/null; then
  echo "❌ ERROR: Alternate app builder detected"
  exit 1
fi

echo "✅ Core enforcement checks passed"

# -------------------------
# 2. Scaffold sentinel tests
# -------------------------

mkdir -p "$TEST_DIR/integration"

GLOBAL_STATE_TEST="$TEST_DIR/integration/global-state-isolation.test.ts"

if [[ ! -f "$GLOBAL_STATE_TEST" ]]; then
  echo "Scaffolding global state isolation test"
  cat >"$GLOBAL_STATE_TEST" <<'EOF'
import { describe, test, expect, afterEach } from "vitest";
import {
  setServiceMode,
  getServiceMode,
  _resetServiceModeForTests,
} from "../../src/lib/service-mode.js";

describe("global state isolation", () => {
  afterEach(() => {
    _resetServiceModeForTests();
  });

  test("service mode can be modified", () => {
    setServiceMode("read-only");
    expect(getServiceMode()).toBe("read-only");
  });

  test("service mode resets between tests", () => {
    expect(getServiceMode()).toBe("normal");
  });
});
EOF
fi

AUTH_TEST="$TEST_DIR/integration/auth.boundaries.test.ts"

if [[ ! -f "$AUTH_TEST" ]]; then
  echo "Scaffolding auth boundary tests"
  cat >"$AUTH_TEST" <<'EOF'
import { describe, test, expect } from "vitest";
import { buildTestApp } from "../helpers/build-test-app.js";

describe("auth boundaries", () => {
  test("blocks unauthenticated access", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/tax/health",
    });

    expect(res.statusCode).toBe(401);
  });
});
EOF
fi

# -------------------------
# 3. Verify buildTestApp usage
# -------------------------

echo "Verifying buildTestApp usage..."

MISSING_BUILDER=$(grep -R "test(" "$TEST_DIR" \
  | grep -v buildTestApp \
  | grep -v helpers \
  || true)

if [[ -n "$MISSING_BUILDER" ]]; then
  echo "❌ ERROR: Some tests do not import buildTestApp"
  echo "$MISSING_BUILDER"
  exit 1
fi

echo "✅ buildTestApp usage verified"

# -------------------------
# 4. Done
# -------------------------

echo "== Test spine enforced successfully =="
echo "If tests fail now, they are real failures."
