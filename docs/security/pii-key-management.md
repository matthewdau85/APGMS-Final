# PII key management

The API gateway consumes encryption keys and token salts from environment
configuration so that decryption is only possible when the service is deployed
with the correct secrets. The loader supports two delivery mechanisms:

- **Direct base64 material** – the `material`/`secret` field is a base64 encoded
  32 byte AES key or token salt.
- **AWS KMS ciphertext** – the `ciphertext` field is a base64 encoded blob
  produced by `aws kms encrypt`. The service decrypts the blob at start-up using
  the region provided by `PII_KMS_REGION` (or `AWS_REGION`).

## Environment variables

| Variable | Description |
| --- | --- |
| `PII_ENCRYPTION_KEYS` | JSON array of `{ "kid": string, "material"?: string, "ciphertext"?: string }`. Each entry must provide either `material` or `ciphertext`. AES-256 keys must decode to 32 bytes. |
| `PII_ENCRYPTION_ACTIVE_KID` | Identifier of the key the API gateway should use when encrypting new payloads. |
| `PII_TOKEN_SALTS` | JSON array of `{ "sid": string, "secret"?: string, "ciphertext"?: string }`. Salts must decode to at least 16 bytes. |
| `PII_TOKEN_ACTIVE_SID` | Identifier of the active salt used for TFN tokenisation. |
| `PII_KMS_REGION` | Optional. Region used when decrypting ciphertext entries with AWS KMS. If omitted we fall back to `AWS_REGION`. |

All variables must be present for the service to decrypt TFNs. Missing or
malformed configuration causes the `/admin/pii/decrypt` route to return
`pii_unconfigured` until a valid configuration is provided.

## Rotation procedure

1. **Generate new material**
   - To rotate with KMS, run `aws kms encrypt --key-id <KEY_ARN> --plaintext fileb://key.bin --query CiphertextBlob --output text` to produce a ciphertext blob for the new 32 byte key or salt.
   - For direct secrets store, create a 32 byte random value using `openssl rand -base64 32` for AES keys and at least 16 bytes for salts.
2. **Update `PII_ENCRYPTION_KEYS` / `PII_TOKEN_SALTS`**
   - Append the new entry with its `kid`/`sid` and ciphertext (or base64 material).
   - Keep at least one previous entry available so old payloads remain decryptable.
3. **Activate the new version**
   - Set `PII_ENCRYPTION_ACTIVE_KID` or `PII_TOKEN_ACTIVE_SID` to the identifier of the new entry.
   - Deploy the configuration. The API gateway logs the active identifiers once configured.
4. **Verify**
   - Call the `/admin/pii/decrypt` endpoint using an admin token to ensure encryption/decryption still succeeds.
   - Confirm audit logs show the new key identifier.
5. **Retire old material**
   - After any historical payloads encrypted with the previous key/salt are no longer needed, remove the retired entry from the JSON arrays and redeploy.

Keep ciphertext blobs and raw key material out of version control. Store them in
secrets management (e.g. AWS Secrets Manager or SSM Parameter Store) and inject
as environment variables at deploy time.
