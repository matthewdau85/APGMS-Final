# @apgms/api

Shared Fastify plugin + documentation assets for the onboarding service. It exposes Zod-validated routes and the OpenAPI/TypeDoc artifacts consumed by SDKs and customers.

## Usage

```ts
import Fastify from 'fastify';
import { registerOnboardingApi } from '@apgms/api';

const app = Fastify();
await registerOnboardingApi(app, { productName: 'Payroll Hub' });
await app.listen({ port: 3000 });
```

## Scripts

* `pnpm --filter @apgms/api build` – compile TypeScript to `dist/`.
* `pnpm --filter @apgms/api docs` – run TypeDoc using `typedoc.json` outputting to `docs/reference/`.
* `pnpm --filter @apgms/api openapi:lint` – lint `openapi.yaml` with Spectral.
