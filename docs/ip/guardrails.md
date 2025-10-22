# Intellectual property guardrails

This document sets expectations for protecting APGMS intellectual property (IP) during
collaborations with partners, vendors, and contractors.

## Classification

- **Public:** marketing materials, published blog posts, and product documentation.
- **Confidential:** product roadmaps, customer lists, pricing strategies, compliance controls.
- **Restricted:** source code, TFN handling procedures, security architecture diagrams, and
  unreleased product designs.

## Handling requirements

| Classification | Storage | Sharing | Retention |
| --- | --- | --- | --- |
| Public | Any approved system | Share freely | Until superseded |
| Confidential | Google Drive (restricted folders), Slack DMs with retention | Share only with NDA in place | Review quarterly |
| Restricted | Encrypted repositories (GitHub, SecureShare), no local storage without approval | Share via SecureShare with MFA and watermarking | Destroy when project ends |
| Highly restricted | Zero-trust workspaces with session recording | Do not share externally; internal need-to-know approval only | Destroy within 30 days post-project |

## Engagement guardrails

1. All third parties must sign the APGMS Master Services Agreement including IP clauses before
   receiving access.
2. Use clean-room environments when reviewing competitor assets; do not ingest or store
   third-party confidential information in APGMS systems.
3. Contractors must use APGMS-managed devices enrolled in MDM with disk encryption enabled and
   conditional access tied to device health.
4. Access reviews for third parties occur monthly and are tracked in the compliance vault with
   results streamed to the compliance scorecard.
5. AI-assisted tooling must run in approved environments with prompt/response logs retained in
   the evidence vault when Restricted or Highly restricted data is processed.

## Incident response

- Report suspected IP leakage immediately in the `#security` channel and open an incident ticket.
- Security will evaluate scope, revoke access, and work with Legal on notification obligations.
- Post-incident review must capture root cause, mitigation steps, and required policy updates.
- Update the DSP OSF evidence index with remediation artefacts and flag any affected partner shares.

