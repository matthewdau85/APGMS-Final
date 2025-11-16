# @apgms/sdk-typescript

Minimal TypeScript SDK for the onboarding API. It wraps fetch with auth headers, consistent user-agent tagging, and sensible defaults (timeouts, retries can be layered later).

## Install

```bash
pnpm add @apgms/sdk-typescript
```

## Usage

```ts
import { OnboardingClient } from '@apgms/sdk-typescript';

const client = new OnboardingClient({ baseUrl: 'https://api.apgms.local/v1', apiKey: process.env.APGMS_API_KEY! });
await client.createMigration({
  orgId: 'uuid',
  sourceSystem: 'gusto',
  targetLedger: 'netsuite',
});
```
