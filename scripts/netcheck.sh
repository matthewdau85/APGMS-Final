#!/usr/bin/env bash
set -euo pipefail

# net-check.sh
# Purpose: Quickly detect DNS failures, routing issues, and basic throughput
#          both on host and inside a minimal Docker container.

TIMEOUT_SEC="${TIMEOUT_SEC:-8}"
DL_BYTES="${DL_BYTES:-5000000}" # ~5MB

say() { printf "%s\n" "$*"; }

section() {
  say ""
  say "## $*"
}

probe_dns() {
  local host="$1"
  say "== DNS: ${host} =="
  if command -v getent >/dev/null 2>&1; then
    (getent hosts "$host" && say "[OK] getent hosts $host") || say "[FAIL] getent hosts $host"
  else
    say "[WARN] getent not available"
  fi

  if command -v nslookup >/dev/null 2>&1; then
    (nslookup "$host" >/dev/null 2>&1 && say "[OK] nslookup $host") || say "[FAIL] nslookup $host"
  else
    say "[WARN] nslookup not available"
  fi

  if command -v dig >/dev/null 2>&1; then
    (dig +time=2 +tries=1 "$host" A >/dev/null 2>&1 && say "[OK] dig $host") || say "[FAIL] dig $host"
  else
    say "[WARN] dig not available"
  fi
}

probe_http_headers() {
  local url="$1"
  say "== HTTP HEAD: ${url} =="
  curl -I -sS --max-time "$TIMEOUT_SEC" "$url" >/dev/null \
    && say "[OK] HEAD $url" \
    || say "[FAIL] HEAD $url"
}

probe_speed() {
  local url="$1"
  say "== SPEED: ${url} (download ~${DL_BYTES} bytes) =="
  # -r 0-N requests a byte range; many CDNs support it.
  # report: http_code, total time, download speed, bytes downloaded
  curl -sS --max-time "$((TIMEOUT_SEC * 6))" -r "0-$((DL_BYTES - 1))" -o /dev/null \
    -w "http_code=%{http_code} time_total=%{time_total}s speed=%{speed_download}B/s size=%{size_download}B\n" \
    "$url" \
    || true
}

probe_tls() {
  local host="$1"
  say "== TLS connect: ${host}:443 =="
  # quick check that TCP+TLS handshake works
  if command -v openssl >/dev/null 2>&1; then
    echo | openssl s_client -connect "${host}:443" -servername "$host" -brief >/dev/null 2>&1 \
      && say "[OK] openssl s_client $host" \
      || say "[FAIL] openssl s_client $host"
  else
    say "[WARN] openssl not available"
  fi
}

docker_probe() {
  section "Docker probes (isolated container network)"
  if ! command -v docker >/dev/null 2>&1; then
    say "[SKIP] docker not installed"
    return 0
  fi

  # Use a small image that typically already exists on dev machines; fallback to debian if needed.
  local img="node:20.19.6-bookworm-slim"

  say "== Docker: pulling/using $img (if needed) =="
  docker pull "$img" >/dev/null 2>&1 || true

  docker run --rm "$img" bash -lc "
    set -euo pipefail
    echo 'container node:' \$(node -v)
    apt-get update >/dev/null 2>&1 || true
    apt-get install -y --no-install-recommends ca-certificates curl dnsutils >/dev/null 2>&1 || true

    echo '--- DNS inside container ---'
    getent hosts registry.npmjs.org || true
    getent hosts pypi.org || true
    (nslookup registry.npmjs.org >/dev/null 2>&1 && echo '[OK] nslookup registry.npmjs.org') || echo '[FAIL] nslookup registry.npmjs.org'
    (nslookup pypi.org >/dev/null 2>&1 && echo '[OK] nslookup pypi.org') || echo '[FAIL] nslookup pypi.org'

    echo '--- HTTP HEAD inside container ---'
    curl -I -sS --max-time ${TIMEOUT_SEC} https://registry.npmjs.org/ >/dev/null && echo '[OK] HEAD npm registry' || echo '[FAIL] HEAD npm registry'
    curl -I -sS --max-time ${TIMEOUT_SEC} https://pypi.org/simple/ >/dev/null && echo '[OK] HEAD pypi simple' || echo '[FAIL] HEAD pypi simple'

    echo '--- Speed inside container ---'
    curl -sS --max-time $((TIMEOUT_SEC * 6)) -r 0-$((DL_BYTES - 1)) -o /dev/null -w 'npm: http_code=%{http_code} time_total=%{time_total}s speed=%{speed_download}B/s size=%{size_download}B\n' https://registry.npmjs.org/ || true
    curl -sS --max-time $((TIMEOUT_SEC * 6)) -r 0-$((DL_BYTES - 1)) -o /dev/null -w 'pypi: http_code=%{http_code} time_total=%{time_total}s speed=%{speed_download}B/s size=%{size_download}B\n' https://pypi.org/simple/ || true
  " || true
}

section "Host probes"

probe_dns "registry.npmjs.org"
probe_http_headers "https://registry.npmjs.org/"
probe_speed "https://registry.npmjs.org/"

probe_dns "pypi.org"
probe_http_headers "https://pypi.org/simple/"
probe_speed "https://pypi.org/simple/"

probe_tls "registry.npmjs.org"
probe_tls "pypi.org"

docker_probe

section "If DNS fails"
say "Most common cause on WSL/Docker: broken or slow DNS resolver."
say "Next steps are in the chat response."
