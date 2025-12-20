# EV-LEDGER-INTEGRITY — Tax Ledger Hash-Chain Integrity

## Control Objective
Ensure tax ledger entries cannot be modified without detection.

## Control Description
Each tax ledger entry includes:
- hashSelf: SHA-256 of entry contents
- hashPrev: SHA-256 of previous entry

This forms an append-only hash chain.

## Verification Method
Automated tests:
- Create valid ledger chains
- Tamper with amountCents and hashPrev
- Assert detection via verifyChain()

## Evidence
- Test: `tests/ledger/tax-ledger.hash.test.ts`
- Execution requires `RUN_DB_TESTS=1`
- CI executes DB-backed tests on every PR

## Result
- Untampered chains pass verification
- Any mutation is detected with index and reason

## Assurance Level
High — cryptographic integrity + automated verification

## DSP OSF Index
- `docs/compliance/dsp-osf-evidence-index.md`
