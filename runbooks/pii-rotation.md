# PII key and salt rotation

This runbook documents how to rotate the encryption materials that back the API
Gateway PII utilities (`encryptPII`, `decryptPII`, and `tokenizeTFN`). The
application loads a KMS-backed AES key and a Secrets Manager salt during
bootstrap via the `bootstrapPII` helper.

## Prerequisites

* AWS credentials with permissions for KMS `Decrypt`, `GenerateDataKey`, and
  Secrets Manager `GetSecretValue`/`PutSecretValue`.
* The current environment variables:
  * `PII_KMS_KEYS` – JSON array of KMS-encrypted data keys.
  * `PII_KMS_ACTIVE_KEY_ID` – the key identifier that should be used for new
    encrypt operations.
  * `PII_SALT_SECRETS` – JSON array mapping salt identifiers to Secrets Manager
    secret IDs.
  * `PII_SALT_ACTIVE_ID` – the salt identifier used when tokenising TFNs.

## Rotation steps

1. **Generate a new data key**
   1. Run `aws kms generate-data-key --key-id <customer-master-key>` with
      `--key-spec AES_256`.
   2. Capture both the `CiphertextBlob` (base64) and the plaintext key (also
      base64). Store the plaintext key in a secure vault until the rollout
      completes.
2. **Create the new salt secret**
   1. Generate 32 bytes of random data: `openssl rand -base64 32`.
   2. Store the base64 string as a new Secrets Manager secret JSON payload in
      the shape `{ "value": "<base64-string>" }`.
3. **Update application configuration**
   1. Append the new data key entry to `PII_KMS_KEYS`, e.g.
      ```json
      [{ "kid": "pii-key-v2", "ciphertext": "<CiphertextBlob>" }]
      ```
   2. Set `PII_KMS_ACTIVE_KEY_ID=pii-key-v2`.
   3. Append the new salt definition to `PII_SALT_SECRETS`, e.g.
      ```json
      [{ "sid": "salt-v2", "secretId": "arn:aws:secrets:..." }]
      ```
   4. Set `PII_SALT_ACTIVE_ID=salt-v2`.
4. **Deploy** – roll out the environment variables alongside the application
   release. The bootstrapper logs `pii providers initialised` with the active
   key/salt identifiers when successful.
5. **Validate**
   1. Run the API Gateway `pnpm test` suite or the CI pipeline to execute the
      PII integration test, which performs an encrypt/decrypt round-trip using
      the configured providers.
   2. Exercise `/admin/pii/decrypt` with a test payload and verify that the
      audit log contains the `pii.decrypt` entry.
6. **Clean up** – once no ciphertexts remain for the previous key/salt, remove
   the old entries from `PII_KMS_KEYS`/`PII_SALT_SECRETS` and delete the retired
   Secrets Manager secret.

## Rollback

If decryption fails after the rotation, revert `PII_KMS_ACTIVE_KEY_ID` and
`PII_SALT_ACTIVE_ID` to their previous values. Because the historical entries
remain in `PII_KMS_KEYS` and `PII_SALT_SECRETS`, the application can continue to
resolve old identifiers.
