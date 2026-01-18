#!/usr/bin/env bash
set -euo pipefail
APP="services/api-gateway/src/app.ts"
[ -f "$APP" ] || { echo "Missing $APP"; exit 2; }

tmp="$(mktemp)"
awk '
  BEGIN{ keepImport=1; keepRegister=1 }
  {
    if ($0 ~ /^import[[:space:]]+newRoutes[[:space:]]+from[[:space:]]+.\.\/routes\/new-routes\.js.;[[:space:]]*$/) {
      if (keepImport) { print; keepImport=0 } else { next }
    } else if ($0 ~ /app\.register\(newRoutes\);[[:space:]]*$/) {
      if (keepRegister) { print; keepRegister=0 } else { next }
    } else {
      print
    }
  }
' "$APP" > "$tmp"
mv "$tmp" "$APP"
echo "Deduplicated newRoutes import/registration in $APP"
