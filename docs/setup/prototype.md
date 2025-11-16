# Prototype / Demo Environment Guide

Use this guide to spin up a lightweight APGMS demo with the mock banking
provider, pre-seeded test data, and scripted BAS simulations. It is ideal for
sales demos, internal training, or partner walk-throughs when real bank access
is unavailable.

## 1. Install dependencies

1. Ensure Node 20.11.x and PNPM 9 are installed (see README prerequisites).
2. Install Playwright browsers for the UI smoke checks:
   ```bash
   pnpm exec playwright install --with-deps
   ```
3. Start the default services:
   ```bash
   pnpm install --frozen-lockfile
   docker compose up -d
   pnpm -w exec prisma migrate dev
   ```

## 2. Configure the mock provider

Create `services/api-gateway/.env` (or copy `.env.example`) and set:

```
BANKING_PROVIDER=mock
BANKING_MAX_READ_TRANSACTIONS=200
BANKING_MAX_WRITE_CENTS=1000000
DESIGNATED_BANKING_URL=https://mock-banking.local
DESIGNATED_BANKING_TOKEN=demo-token
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Leave other variables at their README defaults. The mock adapter never calls an
external endpoint but still logs the configured URL/token for audit trails.

## 3. Launch the stack

```bash
pnpm --filter @apgms/api-gateway dev
pnpm --filter @apgms/webapp dev
```

Navigate to `http://localhost:5173` for the UI. The API listens on
`http://localhost:3000`.

## 4. Seed demo data

1. Import sample organisations and bank lines:
   ```bash
   pnpm exec tsx scripts/seed.ts
   ```
   The script provisions `demo-org` with encrypted bank lines and a seeded user.
2. Run the designated-account job once:
   ```bash
   pnpm exec tsx worker/src/index.ts
   ```

## 5. Exercise the flows

| Flow | Command |
| --- | --- |
| Generate synthetic banking lines | `curl -XPOST http://localhost:3000/demo/banking/generate -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-1' -d '{"orgId":"demo-retail","amount":125000}'` |
| Simulate BAS lodgement | `curl -XPOST http://localhost:3000/compliance/transfer -H 'Content-Type: application/json' -H 'Authorization: Bearer <jwt>' -d '{"orgId":"demo-org","amount":150000,"source":"PAYROLL_CAPTURE"}'` |
| View discrepancies in UI | Visit `/dashboard` in the webapp and inspect the PAYGW/GST widgets. |
| Trigger regulator portal | `pnpm smoke:regulator` then log into `/regulator` with the generated token. |

## 6. Demo checklist

1. Show `/compliance/status` to highlight tier changes when transactions post.
2. Use the discrepancy cards to add funds or reschedule transfers (UI controls
   are wired to the mock provider).
3. Capture screenshots of the dashboard + regulator portal for later reference.
4. Export the evidence list (`/regulator/evidence`) to demonstrate auditability.

## 7. Resetting the environment

```bash
pnpm exec prisma migrate reset
pnpm exec tsx scripts/seed.ts
pnpm exec tsx worker/src/index.ts
```

The reset wipes all demo transactions and replays the seed so you can start a
fresh walkthrough.
