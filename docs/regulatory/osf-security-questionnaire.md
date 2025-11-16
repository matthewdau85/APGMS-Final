# OSF Security Questionnaire

This appendix captures the answers required by the ATO Digital Service Provider (DSP) Operations Security Framework (OSF). It documents the controls we implemented in the API gateway, worker, and provider stacks so reviewers can validate the posture quickly.

| Section | Question | Response |
| --- | --- | --- |
| 1.1 | Does the product enforce MFA for privileged users? | Yes – WebAuthn + TOTP enforcement lives in `services/api-gateway/src/security/mfa.ts`, and the regulator portal refuses access unless `mfaEnabled=true`. |
| 1.2 | How are authentication secrets stored? | Secrets are resolved from Vault using the secret hydrator (`services/api-gateway/src/lib/secret-hydrator.ts`) before the Fastify app boots. The `.env` file is now a thin bootstrapper that only contains Vault references (e.g. `vault://kv/data/apgms#DATABASE_URL`). |
| 1.3 | Describe the designated account controls. | All bank interactions call `applyDesignatedAccountTransfer` via the provider adapters in `providers/banking/*`. Debit attempts raise `designated_withdrawal_attempt` errors that get logged into the audit trail. |
| 2.1 | Which audit evidence is produced for PAYGW/GST? | Evidence artifacts are exported via `scripts/export-evidence-pack.ts` and attached to `/compliance/evidence`. The reconciliation generator inside `@apgms/domain-policy` produces hashed, tamper-evident bundles. |
| 2.4 | What is the incident response playbook? | `runbooks/ops.md` + `runbooks/compliance-monitoring.md` enumerate the paging policy, regulator notification contact list, and post-incident evidence capture steps. |
| 3.2 | How do you segregate production secrets from development? | The Vault bootstrapper enforces `SECRETS_PROVIDER=vault` in CI/CD and retrieves scoped KV payloads per environment. Local development can continue to use `.env` files when the provider is set to `env`. |
| 4.5 | Provide the DSP product registration tracker. | `status/dsp-product-tracker.md` lists the DSP Product ID, OSF submission ID, AUSTRAC reference, and the pilot organisations used to demonstrate compliance. |
| 5.1 | Describe STP integration testing. | `/ato/stp/report` emits Single Touch Payroll payloads that include the hashed signature, pay-run metadata, and payslip summaries. `scripts/pilot-data-seeder.ts` exercises these endpoints nightly so regulators can replay the data set. |

## Submission log

- **2025-02-04** – Questionnaire completed, linked to the security evidence pack stored at `artifacts/backups/evidence-pack_<org>_<timestamp>.json`.
- **2025-02-05** – Submitted to the OSF portal with the DSP reference `DSP-APGMS-01`. Awaiting reviewer acknowledgement.
