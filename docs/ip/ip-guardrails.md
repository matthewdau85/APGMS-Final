# IP Guardrails – APGMS

Version: 0.1
Last updated: YYYY-MM-DD
Owner: APGMS Team

## Purpose

This document sets guardrails to protect APGMS intellectual property while enabling safe reuse of open-source components. It is written for internal use and for sharing with partners/investors when needed.

This is not legal advice; it is an operational policy that should be reviewed by counsel.

---

## What is APGMS proprietary

The following are intended to be treated as APGMS proprietary concepts and implementations (subject to counsel review and novelty checks):

1) Designated one-way account pattern
- A deposit-only tax buffer / sub-ledger mechanism designed to reduce misuse risk and improve compliance outcomes.
- Includes rules for allowable flows, restrictions, and auditability.

2) Reconciliation Pass Tokens (RPTs)
- A cryptographic or verifiable artefact used to prove settlement/reconciliation steps occurred in an auditable chain.

3) Settlement lifecycle orchestration model
- Instruction-based settlement lifecycle with explicit transitions and evidence-centric audit posture.
- Includes incident-safe “service mode” operational model and controls.

4) Evidence-pack / regulator-ready operating model
- The structured approach to packaging code, tests, readiness, scans, and documentation into an immutable “evidence snapshot”.

Note: The above statements are intent; legal protection depends on implementation details, documentation, and novelty.

---

## What can be open-sourced (safe candidates)

These components are generally safe to open-source if decoupled from proprietary logic and reviewed for secrets/IP leakage:

- Generic infrastructure templates (CI workflows, lint/test pipelines)
- Non-domain-specific utilities (formatting, scaffolding, test harnesses)
- Observability glue code (OTel bootstrapping, log formatters) if generic
- Readiness scripts that don’t disclose proprietary models

Policy:
- Strip secrets, keys, URLs, partner identifiers
- Ensure licenses are compatible and documented
- Remove or abstract proprietary business rules and domain policy

---

## Open-source reuse rules (third-party components)

1) License compliance
- Track licenses for dependencies (SBOM recommended).
- Respect attribution requirements.
- Avoid copyleft contamination unless explicitly approved.

2) Forking and modification
- Prefer upstream contributions when feasible.
- Maintain a record of modifications for auditability.

3) Provenance
- Maintain dependency lockfiles.
- Pin versions in production releases.

---

## Confidentiality and partner sharing rules

1) “Need-to-know” principle
- Share only what is required to integrate or validate.

2) Evidence packs
- Provide immutable evidence snapshots by commit SHA.
- Redact any sensitive internal operational material not required for review.

3) Partner documents
- Clearly state roles/responsibilities, failure semantics, and security expectations.
- Avoid disclosing internal architecture details beyond what is necessary.

---

## Trade secrets and security-sensitive material

Never publish or share externally:
- authentication secrets, admin tokens, private keys, KMS configuration
- internal incident runbooks that reveal attack paths
- partner/customer data
- internal-only endpoints unless secured and explicitly disclosed as such

---

## Naming, branding, and trademarks

- “APGMS” naming, logos, and brand assets are proprietary unless explicitly licensed.
- Partners may reference the product name only per written approval.

---

## Contribution policy (internal and external)

Internal contributions:
- All work is assigned to the APGMS entity under employment/contract terms.

External contributions (if ever accepted):
- Require signed contributor agreement (CLA) or equivalent assignment.
- Contributions must be reviewed for IP contamination and licensing risk.

---

## Enforcement checklist (pre-release)

Before any public release or partner sharing:
1) Run secret scan and confirm clean results
2) Confirm license inventory and approvals
3) Confirm removal of proprietary domain rules from public artefacts
4) Confirm evidence pack created from tagged commit SHA
5) Confirm partner docs reflect current behavior and modes
