# STP/BAS conformance evidence

- Generated: 2025-11-16T11:53:42.380157+00:00
- Commit: 902b7a1767d6702c7771a2d069bbf40d6e97ffbe

## Command: pnpm --filter @apgms/payroll test
```
> @apgms/payroll@0.1.0 test /workspace/APGMS-Final/services/payroll
> pnpm exec jest --config ../../jest.config.js --runTestsByPath ../../services/payroll/tests/stp.conformance.test.ts

 PASS  services/payroll/tests/stp.conformance.test.ts
  ✓ matches the official schema and the golden payload (12 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        13.026 s
Ran all test suites within paths "../../services/payroll/tests/stp.conformance.test.ts".
```

## Command: pnpm --filter @apgms/ato test
```
> @apgms/ato@0.1.0 test /workspace/APGMS-Final/providers/ato
> pnpm exec jest --config ../../jest.config.js --runTestsByPath ../../providers/ato/tests/atoClients.test.ts

 PASS  providers/ato/tests/atoClients.test.ts
  ✓ submits STP pay events with software identifiers (9 ms)
  ✓ submits BAS statements via the lodgement endpoint (1 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        7.852 s
Ran all test suites within paths "../../providers/ato/tests/atoClients.test.ts".
```
