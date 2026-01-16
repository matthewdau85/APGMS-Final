#!/usr/bin/env bash
# APGMS workspace repair (WSL-safe)
# - Install missing deps (webapp test, shared/api runtime, prisma toolchain)
# - Generate Prisma client
# - Typecheck, build, readiness

set -euo pipefail
sed -i 's/\r$//' "$0" 2>/dev/null || true

ROOT="${ROOT:-$PWD}"
LOG="$ROOT/logs/wsl-fix-workspace-v7-$(date -u +%Y%m%dT%H%M%SZ).log"
echo "[fix] repo: $ROOT" | tee -a "$LOG"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" | tee -a "$LOG"; exit 2; }; }
need node; need sed; need grep

# Normalize CRLF on scripts just in case
if [ -d "$ROOT/scripts" ]; then
  find "$ROOT/scripts" -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;
fi

# Ensure pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable || true
    corepack prepare pnpm@9 --activate || true
bash scripts/wsl-fix-workspace-v7.sh7.shcho "[warn] readiness failed; see logs"; }uing"; }uing"; }-a "$LOG"
[fix] repo: /home/matth/src/APGMS
[deps] add prisma toolchain @6.19.0 (workspace devDeps)
 WARN  `node_modules` is present. Lockfile only installation will make it out-of-date
Progress: resolved 1, reused 0, downloaded 0, added 0
Progress: resolved 103, reused 0, downloaded 0, added 0
Progress: resolved 105, reused 0, downloaded 0, added 0
Progress: resolved 154, reused 0, downloaded 0, added 0
Progress: resolved 438, reused 0, downloaded 0, added 0
Progress: resolved 574, reused 0, downloaded 0, added 0
Progress: resolved 724, reused 0, downloaded 0, added 0
Progress: resolved 824, reused 0, downloaded 0, added 0
Progress: resolved 959, reused 0, downloaded 0, added 0
Progress: resolved 963, reused 0, downloaded 0, added 0
Progress: resolved 982, reused 0, downloaded 0, added 0
Progress: resolved 1006, reused 0, downloaded 0, added 0
Progress: resolved 1025, reused 0, downloaded 0, added 0
Progress: resolved 1041, reused 0, downloaded 0, added 0
Progress: resolved 1086, reused 0, downloaded 0, added 0
Progress: resolved 1105, reused 0, downloaded 0, added 0
Progress: resolved 1112, reused 0, downloaded 0, added 0
 WARN  5 deprecated subdependencies found: @opentelemetry/otlp-proto-exporter-base@0.50.0, @smithy/core@3.18.4, acorn-import-assertions@1.9.0, glob@7.2.0, inflight@1.0.6
Progress: resolved 1112, reused 0, downloaded 0, added 0, done

devDependencies:
+ @prisma/client 6.19.0

Already up to date
Done in 17.7s using pnpm v9.15.9
[deps] ensure runtime deps: shared(zod,nats), api-gateway(zod,@fastify/cors,fastify)
.                                        |  WARN  `node_modules` is present. Lockfile only installation will make it out-of-date
Progress: resolved 1, reused 0, downloaded 0, added 0
Progress: resolved 102, reused 0, downloaded 0, added 0
Progress: resolved 104, reused 0, downloaded 0, added 0
Progress: resolved 175, reused 0, downloaded 0, added 0
Progress: resolved 472, reused 0, downloaded 0, added 0
Progress: resolved 602, reused 0, downloaded 0, added 0
Progress: resolved 775, reused 0, downloaded 0, added 0
Progress: resolved 961, reused 0, downloaded 0, added 0
Progress: resolved 969, reused 0, downloaded 0, added 0
Progress: resolved 989, reused 0, downloaded 0, added 0
Progress: resolved 1026, reused 0, downloaded 0, added 0
Progress: resolved 1066, reused 0, downloaded 0, added 0
Progress: resolved 1101, reused 0, downloaded 0, added 0
 WARN  5 deprecated subdependencies found: @opentelemetry/otlp-proto-exporter-base@0.50.0, @smithy/core@3.18.4, acorn-import-assertions@1.9.0, glob@7.2.0, inflight@1.0.6
Progress: resolved 1112, reused 0, downloaded 0, added 0, done
Done in 13.3s using pnpm v9.15.9
.                                        |  WARN  `node_modules` is present. Lockfile only installation will make it out-of-date
Progress: resolved 1, reused 0, downloaded 0, added 0
Progress: resolved 103, reused 0, downloaded 0, added 0
Progress: resolved 105, reused 0, downloaded 0, added 0
Progress: resolved 376, reused 0, downloaded 0, added 0
Progress: resolved 605, reused 0, downloaded 0, added 0
Progress: resolved 762, reused 0, downloaded 0, added 0
Progress: resolved 954, reused 0, downloaded 0, added 0
Progress: resolved 961, reused 0, downloaded 0, added 0
Progress: resolved 968, reused 0, downloaded 0, added 0
Progress: resolved 995, reused 0, downloaded 0, added 0
Progress: resolved 1026, reused 0, downloaded 0, added 0
Progress: resolved 1069, reused 0, downloaded 0, added 0
Progress: resolved 1112, reused 0, downloaded 0, added 0
 WARN  5 deprecated subdependencies found: @opentelemetry/otlp-proto-exporter-base@0.50.0, @smithy/core@3.18.4, acorn-import-assertions@1.9.0, glob@7.2.0, inflight@1.0.6
Progress: resolved 1112, reused 0, downloaded 0, added 0, done
Done in 13.5s using pnpm v9.15.9
[deps] ensure webapp test dependency: @axe-core/playwright
No projects matched the filters in "/home/matth/src/APGMS"
[install] pnpm install (no frozen lockfile)
Scope: all 10 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date

Done in 1.3s using pnpm v9.15.9
[prisma] generate client from infra schema
Loaded Prisma config from prisma.config.ts.

Prisma config detected, skipping environment variable loading.
Prisma schema loaded from infra/prisma/schema.prisma

✔ Generated Prisma Client (v6.19.0) to ./node_modules/.pnpm/@prisma+client@6.19.0_prisma@6.19.0_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 363ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints

[typecheck] workspace
Scope: 9 of 10 workspace projects

> @apgms/shared@0.1.0 typecheck /home/matth/src/APGMS/shared
> tsc --noEmit -p tsconfig.json


> apgms-webapp@0.1.0 typecheck /home/matth/src/APGMS/webapp
> tsc --noEmit -p tsconfig.json

tests/axe.spec.ts:1:24 - error TS2307: Cannot find module '@axe-core/playwright' or its corresponding type declarations.

1 import AxeBuilder from "@axe-core/playwright";
                         ~~~~~~~~~~~~~~~~~~~~~~


Found 1 error in tests/axe.spec.ts:1

/home/matth/src/APGMS/webapp:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  apgms-webapp@0.1.0 typecheck: `tsc --noEmit -p tsconfig.json`
Exit status 2
[warn] typecheck issues; continuing
[build] workspace
Scope: 9 of 10 workspace projects

> @apgms/shared@0.1.0 prebuild /home/matth/src/APGMS/shared
> prisma generate --schema=../infra/prisma/schema.prisma

Loaded Prisma config from prisma.config.ts.

Prisma config detected, skipping environment variable loading.
Prisma schema loaded from ../infra/prisma/schema.prisma

✔ Generated Prisma Client (v6.19.0) to ./../node_modules/.pnpm/@prisma+client@6.19.0_prisma@6.19.0_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 378ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints


> @apgms/shared@0.1.0 build /home/matth/src/APGMS/shared
> tsc -p tsconfig.json


> apgms-webapp@0.1.0 build /home/matth/src/APGMS/webapp
> vite build

vite v7.2.6 building client environment for production...
✓ 1743 modules transformed.
dist/index.html                   0.69 kB │ gzip:   0.41 kB
dist/assets/index-C6bDNW3O.css   95.60 kB │ gzip:  15.56 kB
dist/assets/index-YWDig1Gh.js   363.63 kB │ gzip: 115.59 kB
✓ built in 3.63s

> @apgms/domain-policy@0.1.0 build /home/matth/src/APGMS/packages/domain-policy
> tsc -p tsconfig.build.json

src/au-tax/paygw-rounding.ts:31:3 - error TS2353: Object literal may only specify known properties, and 'QUARTERLY' does not exist in type 'Record<PayPeriod, number>'.

31   QUARTERLY: 4,
     ~~~~~~~~~

src/evidence/hashEvidencePack.ts:1:28 - error TS2307: Cannot find module 'node:crypto' or its corresponding type declarations.

1 import { createHash } from "node:crypto";
                             ~~~~~~~~~~~~~

src/export/evidence.ts:3:20 - error TS2307: Cannot find module 'crypto' or its corresponding type declarations.

3 import crypto from "crypto";
                     ~~~~~~~~

src/export/evidenceChecksum.ts:1:28 - error TS2307: Cannot find module 'node:crypto' or its corresponding type declarations.

1 import { createHash } from "node:crypto";
                             ~~~~~~~~~~~~~

src/export/verifyEvidence.ts:1:33 - error TS2307: Cannot find module 'node:crypto' or its corresponding type declarations.

1 import { timingSafeEqual } from "node:crypto";
                                  ~~~~~~~~~~~~~

src/export/verifyEvidence.ts:22:28 - error TS2580: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node`.

22     return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
                              ~~~~~~

src/export/verifyEvidence.ts:22:51 - error TS2580: Cannot find name 'Buffer'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node`.

22     return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
                                                     ~~~~~~

src/ledger/tax-ledger.ts:3:20 - error TS2307: Cannot find module 'node:crypto' or its corresponding type declarations.

3 import crypto from "node:crypto";
                     ~~~~~~~~~~~~~

src/outcomes/bas-outcome.ts:3:20 - error TS2307: Cannot find module 'node:crypto' or its corresponding type declarations.

3 import crypto from "node:crypto";
                     ~~~~~~~~~~~~~


Found 9 errors in 7 files.

Errors  Files
     1  src/au-tax/paygw-rounding.ts:31
     1  src/evidence/hashEvidencePack.ts:1
     1  src/export/evidence.ts:3
     1  src/export/evidenceChecksum.ts:1
     3  src/export/verifyEvidence.ts:1
     1  src/ledger/tax-ledger.ts:3
     1  src/outcomes/bas-outcome.ts:3
/home/matth/src/APGMS/packages/domain-policy:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @apgms/domain-policy@0.1.0 build: `tsc -p tsconfig.build.json`
Exit status 1

> @apgms/worker@0.1.0 build /home/matth/src/APGMS/worker
> echo build worker

build worker
[warn] build issues; continuing
[ready] run readiness probe
============================================================
APGMS WSL Readiness Runner
============================================================
[root] /home/matth/src/APGMS
[run_id] 20260116T150804Z
[log] /home/matth/src/APGMS/logs/readiness-run-20260116T150804Z.log

[versions]
v20.19.6
9.15.9
0.34.1

============================================================
1) Ensure API readiness on http://127.0.0.1:3000/ready
============================================================
[api] Port 3000 is in use, but http://127.0.0.1:3000/ready is not returning 200.
[api] Refusing to start a second server. Investigate the listener:
  ss -ltnp | grep ":3000" || true
  curl -i http://127.0.0.1:3000/ready || true
[warn] readiness failed; see logs
[done] Log: /home/matth/src/APGMS/logs/wsl-fix-workspace-v7-20260116T150652Z.log
matth@LAPTOP:~/src/APGMS$
