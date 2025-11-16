# Gusto Payroll Adapter

Sample integration showing how to pull payroll batches from Gusto, normalize them, and send them to the onboarding API via the TypeScript SDK. The adapter is intentionally lightweight so customers can fork and plug in their own secrets manager.

## Run

```bash
pnpm ts-node examples/payroll-gusto/adapter.ts
```
