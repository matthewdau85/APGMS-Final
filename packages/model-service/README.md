# @apgms/model-service

The model service package provides a workspace for running and experimenting with machine
learning pipelines that can be shared across the APGMS platform. It is designed to stay
isolated from the product code while still using the same pnpm tooling as the rest of the
monorepo.

## Getting started

1. Install workspace dependencies (from the repository root):
   ```bash
   pnpm install
   ```
2. Install the model service dependencies only (skips building other workspaces):
   ```bash
   pnpm install --filter @apgms/model-service...
   ```
3. Run the local quality gates:
   ```bash
   pnpm --filter @apgms/model-service lint
   pnpm --filter @apgms/model-service typecheck
   pnpm --filter @apgms/model-service test
   pnpm --filter @apgms/model-service build
   ```

### Python virtual environment (optional)

If you prefer to prototype Python-based ML utilities alongside the Node implementation,
you can create an isolated virtual environment inside this workspace:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../../requirements.txt
```

The virtual environment is entirely optional. All CI hooks rely on the Node toolchain and
only require the commands listed above.

## Scripts

The following scripts are exposed so CI (`pnpm -r <script>`) can discover the workspace
automatically:

- `build`: TypeScript compilation to `dist/`.
- `lint`: ESLint with the repository's TypeScript rules.
- `test`: Jest unit tests using the shared configuration.
- `typecheck`: Strict type checking without emitting files.

## Machine learning dependencies

The package depends on [`@tensorflow/tfjs`](https://www.npmjs.com/package/@tensorflow/tfjs)
so models can be defined and executed entirely within Node. Additional Node or Python
artifacts can be added as required by future experiments without leaking dependencies into
other services.

## Directory structure

```
packages/model-service/
├── README.md
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── src/
│   ├── index.ts
│   └── pipeline.ts
└── tests/
    └── modelService.test.ts
```
