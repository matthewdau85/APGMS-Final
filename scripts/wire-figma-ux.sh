#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# APGMS: Wire Figma design extract into webapp in a controlled way
# - Safe: copies into webapp/src/_figma (does not delete anything)
# - Robust: run from repo root OR from ./webapp
# ------------------------------------------------------------

# Ensure this script is LF (ignore if sed not present)
if command -v sed >/dev/null 2>&1; then
  sed -i 's/\r$//' "$0" || true
fi

# Resolve repo root (run from repo root OR ./webapp)
if [ -d "./webapp" ] && [ -d "./services" ]; then
  REPO_ROOT="$(pwd)"
elif [ "$(basename "$(pwd)")" = "webapp" ] && [ -d "../services" ]; then
  REPO_ROOT="$(cd .. && pwd)"
else
  echo "[FAIL] Run from repo root (./webapp exists) or from ./webapp."
  exit 1
fi

cd "$REPO_ROOT"

if [ ! -d "webapp/src" ]; then
  echo "[FAIL] Expected webapp/src not found at: $REPO_ROOT/webapp/src"
  exit 1
fi

# Locate design extract
DESIGN_DIR=""
if [ -d "_design_extract" ]; then
  DESIGN_DIR="_design_extract"
else
  DESIGN_DIR="$(find . -maxdepth 4 -type d -name "_design_extract" -print -quit || true)"
fi

if [ -z "$DESIGN_DIR" ] || [ ! -d "$DESIGN_DIR" ]; then
  echo "[FAIL] Could not find _design_extract folder in repo."
  exit 1
fi

# Find extracted src folder
CANDIDATE_SRC=""
if [ -d "$DESIGN_DIR/webapp/src" ]; then
  CANDIDATE_SRC="$DESIGN_DIR/webapp/src"
elif [ -d "$DESIGN_DIR/src" ]; then
  CANDIDATE_SRC="$DESIGN_DIR/src"
else
  CANDIDATE_SRC="$(find "$DESIGN_DIR" -maxdepth 4 -type d -name "src" -print -quit || true)"
fi

if [ -z "$CANDIDATE_SRC" ] || [ ! -d "$CANDIDATE_SRC" ]; then
  echo "[FAIL] Could not find an extracted src/ under: $DESIGN_DIR"
  exit 1
fi

echo "==> repo root: $REPO_ROOT"
echo "==> design dir: $DESIGN_DIR"
echo "==> extracted src: $CANDIDATE_SRC"

export REPO_ROOT
export CANDIDATE_SRC

DEST_DIR="webapp/src/_figma"
mkdir -p "$DEST_DIR"

echo "==> copying design extract into $DEST_DIR (safe copy)"
python3 - <<'PY'
import os, shutil
from pathlib import Path

repo = Path(os.environ["REPO_ROOT"])
src = Path(os.environ["CANDIDATE_SRC"])
dst = repo / "webapp" / "src" / "_figma"

ALLOW_EXT = {".ts", ".tsx", ".css", ".scss", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".json"}
SKIP_DIRS = {"node_modules", "dist", "build", ".next", ".git", ".turbo", ".cache", "coverage"}

def should_skip_dir(p: Path) -> bool:
  return any(part in SKIP_DIRS for part in p.parts)

def copy_file(f: Path, out: Path):
  out.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(f, out)

count = 0
for root, dirs, files in os.walk(src):
  rootp = Path(root)
  dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
  if should_skip_dir(rootp):
    continue
  for name in files:
    fp = rootp / name
    ext = fp.suffix.lower()
    if ext not in ALLOW_EXT:
      continue
    rel = fp.relative_to(src)
    out = dst / rel
    copy_file(fp, out)
    count += 1

print(f"[OK] copied {count} files into {dst}")
PY

# Write routing helpers (LF endings) without pathlib newline= (python 3.12 compatibility)
echo "==> writing webapp/src/app/figma/FigmaShell.tsx + routes"
python3 - <<'PY'
from pathlib import Path

def write_lf(path: Path, content: str) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  # Force LF newlines regardless of platform
  content = content.replace("\r\n", "\n").replace("\r", "\n")
  with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

root = Path("webapp/src/app/figma")
shell = root / "FigmaShell.tsx"
routes = root / "figma-routes.tsx"

write_lf(shell, """import React from "react";

type Props = {
  title?: string;
  children: React.ReactNode;
};

export function FigmaShell(props: Props) {
  const { title = "APGMS", children } = props;

  // Minimal, resilient shell: renders even if extracted components differ.
  // Uses your CSS variables for theme, avoiding white-screen UX.
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>{title}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
""")

write_lf(routes, """import React from "react";
import type { RouteObject } from "react-router-dom";
import { FigmaShell } from "./FigmaShell";

// Replace placeholders by importing real extracted pages from: webapp/src/_figma/...
// Example:
// import { DashboardPage } from "../../_figma/pages/DashboardPage";

function Placeholder(props: { name: string }) {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>{props.name}</div>
      <div style={{ opacity: 0.8 }}>
        Wire this route to the extracted Figma page/component by importing it from webapp/src/_figma.
      </div>
    </div>
  );
}

export const figmaRoutes: RouteObject[] = [
  {
    path: "/figma",
    element: (
      <FigmaShell title="APGMS (Figma shell)">
        <Placeholder name="Figma Home" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/dashboard",
    element: (
      <FigmaShell title="Dashboard">
        <Placeholder name="Dashboard" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/obligations",
    element: (
      <FigmaShell title="Obligations">
        <Placeholder name="Obligations" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/reconciliation",
    element: (
      <FigmaShell title="Reconciliation">
        <Placeholder name="Reconciliation" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/evidence-pack",
    element: (
      <FigmaShell title="Evidence Pack">
        <Placeholder name="Evidence Pack" />
      </FigmaShell>
    ),
  },
];
""")

print("[OK] wrote figma shell + routes at webapp/src/app/figma/")
PY

cat <<'TXT'

==> Done.

Next steps:
1) Wire the routes into your router (App.tsx or wherever routes are defined)
2) Start webapp: pnpm -C webapp dev
3) Visit: http://localhost:5173/figma

TXT
