# TaxLedgerEntry Hash Chain Design

## Hash material

For each row, we compute:

hashSelf = SHA256(
  JSON.stringify({
    orgId,
    period,
    category,
    direction,
    amountCents,
    effectiveAt: effectiveAt.toISOString(),
    hashPrev: hashPrev ?? null,
  })
)

- `hashPrev` is the `hashSelf` of the immediately preceding entry for the same org+period+category, ordered by `createdAt` (or `effectiveAt` if more appropriate).
- For the first entry in the chain, `hashPrev` is `null`.

## Invariants

- If **any field** in an entry or its predecessor changes (`orgId`, `period`, `category`, `direction`, `amountCents`, `effectiveAt`, `hashPrev`) the recomputed `hashSelf` will no longer match the stored `hashSelf`.
- Changing any earlier entry in the chain will invalidate all subsequent entries.
