#!/usr/bin/env bash
set -e
set -u
set -o pipefail

ts="$(date -u +%Y%m%dT%H%M%SZ)"

die() { echo "[FAIL] $*" >&2; exit 1; }
log() { echo "==> $*"; }

[ -d "webapp" ] || die "Run from repo root (expected ./webapp)."
[ -f "webapp/package.json" ] || die "Missing webapp/package.json"

backup_one() {
  local f="$1"
  if [ -f "$f" ]; then
    cp -a "$f" "$f.bak-$ts"
    log "backup: $f -> $f.bak-$ts"
  fi
}

write_file() {
  local path="$1"
  shift
  mkdir -p "$(dirname "$path")"
  backup_one "$path"
  # Write with LF newlines
  python3 - <<PY
from pathlib import Path
p = Path("$path")
p.write_text("""$*""".replace("\r\n","\n").replace("\r","\n"), encoding="utf-8", newline="\n")
print("[OK] wrote", p)
PY
}

log "Fixing white-screen + forcing theme background + default dark mode (webapp only)"

# --- 1) Ensure App has a hard error boundary so it never silently whitescreens ---
write_file "webapp/src/app/boot/ErrorBoundary.tsx" 'import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: string;
  stack?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(err: unknown): State {
    const e = err instanceof Error ? err : new Error(String(err));
    return {
      hasError: true,
      error: e.message || String(e),
      stack: e.stack,
    };
  }

  public componentDidCatch(err: unknown, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("React error boundary caught:", err, info);
  }

  public render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>APGMS Webapp</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>UI crashed (render error)</div>
          <p style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.45 }}>
            The app hit a runtime error. The details below are safe to copy/paste back into chat.
          </p>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Message</div>
            <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
{this.state.error || "(no message)"}
            </pre>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Stack</div>
            <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
{this.state.stack || "(no stack)"}
            </pre>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.85 }}>
            Tip: if you only saw a blank screen before, this boundary will now show the real error.
          </div>
        </div>
      </div>
    );
  }
}
'

# --- 2) Force dark mode by default and ensure html/body uses theme vars ---
# The repo has theme variables (webapp/src/styles/theme.css) but "all white" occurs when:
# - default theme is light, and/or
# - html/body background is not applied from --background/--foreground
# We add a tiny boot component + update main to include it.
write_file "webapp/src/app/boot/ThemeInit.tsx" 'import React, { useEffect } from "react";

export function ThemeInit(): null {
  useEffect(() => {
    // Default to dark to avoid the "all white" UX.
    // You can later wire a real toggle + persisted preference.
    const root = document.documentElement;
    if (!root.classList.contains("dark")) {
      root.classList.add("dark");
    }
  }, []);

  return null;
}
'

# --- 3) Update webapp/src/main.tsx (wrap Router + ThemeInit + ErrorBoundary) ---
# (Your design extract main.tsx is bare createRoot; the old backup showed BrowserRouter+AuthProvider.
# We do Router+ErrorBoundary+ThemeInit here and keep the rest inside App.)
backup_one "webapp/src/main.tsx"
python3 - <<'PY'
from pathlib import Path

p = Path("webapp/src/main.tsx")
txt = p.read_text(encoding="utf-8")

# Minimal, robust main entry that ensures:
# - CSS imported
# - BrowserRouter present
# - ErrorBoundary present
# - ThemeInit sets dark class
new = """import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { ErrorBoundary } from "./app/boot/ErrorBoundary";
import { ThemeInit } from "./app/boot/ThemeInit";

import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeInit />
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
"""

p.write_text(new, encoding="utf-8", newline="\n")
print("[OK] updated", p)
PY

# --- 4) Ensure theme actually paints the page background and foreground ---
# We modify theme.css by appending base rules (non-destructive).
backup_one "webapp/src/styles/theme.css"
python3 - <<'PY'
from pathlib import Path

p = Path("webapp/src/styles/theme.css")
txt = p.read_text(encoding="utf-8")

marker = "/* APGMS_THEME_BASE_RULES */"
if marker in txt:
    print("[OK] theme base rules already present; skipping append")
else:
    append = """

/* APGMS_THEME_BASE_RULES */
/* Ensure the theme variables actually paint the page, not just components. */
html, body {
  background-color: var(--background);
  color: var(--foreground);
}

body {
  margin: 0;
  min-height: 100vh;
}
"""
    p.write_text(txt.rstrip() + append, encoding="utf-8", newline="\n")
    print("[OK] appended theme base rules to", p)
PY

# --- 5) Fix the "run from repo root" pitfall: create helper scripts ---
write_file "dev-webapp.sh" '#!/usr/bin/env bash
set -e
set -u
set -o pipefail

cd "$(dirname "$0")"
cd webapp

pnpm install --frozen-lockfile
pnpm dev -- --host 0.0.0.0 --port 5173
'

chmod +x dev-webapp.sh fix-ux-dark-and-white-screen.sh

# Normalize line endings for scripts to avoid CRLF issues in WSL
sed -i 's/\r$//' fix-ux-dark-and-white-screen.sh dev-webapp.sh webapp/src/main.tsx webapp/src/app/boot/ErrorBoundary.tsx webapp/src/app/boot/ThemeInit.tsx webapp/src/styles/theme.css || true

log "Done."
log "Next:"
log "  1) Run: bash fix-ux-dark-and-white-screen.sh"
log "  2) Start webapp: ./dev-webapp.sh"
