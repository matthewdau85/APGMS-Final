# Evidence retention and WORM attestations

The compliance service now emits content-addressed WORM references for all evidence
artifacts. Each artifact stores its SHA-256 digest in Postgres and publishes a
URI of the form `apgms://<scope>/<sha256>` where `scope` is either `evidence`
(compliance snapshots) or `bank` (designated account reconciliations).

## Providers

Retention is handled by a pluggable provider that is selected through the
`RETENTION_PROVIDER` environment variable. Three providers are bundled:

- `internal` (default) – deterministic attestation based on the recorded digest
  and retention policy.
- `s3` / `s3-object-lock` – S3 Object Lock integration; requires
  `RETENTION_S3_BUCKET` and `RETENTION_S3_REGION`.
- `gcs` / `gcs-bucket-lock` – Google Cloud Storage Bucket Lock integration;
  requires `RETENTION_GCS_BUCKET`.

Retention periods are controlled via `RETENTION_EVIDENCE_DAYS` and
`RETENTION_BANK_DAYS`. The API validates provider-specific configuration at
startup and logs the selected provider identifier in the attestation payload.

## Attestation endpoint

Consumers can retrieve a signed attestation for any artifact via:

- `/compliance/evidence/:id/attestation` (authenticated organisation users)
- `/regulator/evidence/:id/attestation` (regulator portal)

Responses include the content-addressed URI, SHA-256 digest, provider ID,
lock state, and retention expiry. The regulator portal renders this information
inside the evidence detail view and shows a "Verified & locked until …" badge
once the attestation is loaded.

## Retention mirroring

Designated account reconciliation artifacts reuse the same provider interface
and URI scheme. The nightly worker writes the content-addressed URI to the
`EvidenceArtifact` table so the attestation endpoint can derive retention info
consistently across both compliance and banking evidence.
