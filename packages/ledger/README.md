# @apgms/ledger

## Tests

Run the unit tests with coverage via the package script:

```bash
pnpm --filter @apgms/ledger test
```

This delegates to `pnpm exec jest --config ../../jest.config.js --runTestsByPath ../../packages/ledger/tests/journalWriter.test.ts --coverage` to ensure the package-specific suite runs consistently across platforms.
