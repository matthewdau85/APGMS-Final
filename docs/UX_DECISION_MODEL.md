Purpose



This document defines the human decision model enforced by APGMS and the system behaviors that support determinism, auditability, and regulator-grade evidence.



UX must not introduce implied approvals, silent defaults, or discretionary automation outside these rules.



1\. Human Decisions (Explicit \& Required)



These decisions must be made by a human and explicitly acknowledged.



1.1 Spec Selection \& Reliance



Human decision:



“This is the tax specification I am relying on for this computation.”



Requirements



The user must explicitly acknowledge:



Spec name



Spec version



Effective date



Acknowledgment is:



required before computation



immutable once recorded



linked to every output produced



System behavior



APGMS refuses to compute without acknowledgment



If the spec version changes, acknowledgment must be repeated



No implied acceptance via defaults or background selection



1.2 Period \& Scope Selection



Human decision:



“This is the reporting period and scope I want computed.”



Requirements



User explicitly selects:



reporting period



entity / org scope



Once computation begins, the period is locked to that run



System behavior



Same inputs + same spec + same period ⇒ same outputs



Period changes require a new computation and evidence trail



1.3 Lodgement Authorization



Human decision:



“I am authorizing lodgement of these computed obligations.”



Requirements



Lodgement must reference:



computation ID



evidence pack ID



Lodgement cannot proceed if:



computation evidence is incomplete



spec acknowledgment is missing



System behavior



Lodgement is an irreversible action



Evidence of authorization is recorded immutably



1.4 Payment Consent (Optional Automation)



Human decision:



“I authorize payment of this specific ledger balance.”



Requirements



Consent must be:



explicit



tied to:



exact ledger balance



specific evidence pack



single-purpose (not general or open-ended)



System behavior



Payment automation executes only if consent exists



Consent mismatch → hard block



Consent record becomes part of evidence



2\. System Actions (Deterministic Only)



APGMS does not decide. It executes deterministically.



2.1 Computation



Inputs:



raw financial data



selected period



acknowledged spec



system version



Outputs:



obligations



ledger entries



evidence pack



Guarantee



Same inputs + same spec + same system version

⇒ identical outputs, ledger entries, and evidence



2.2 Ledger Recording



All obligations are written to the ledger



Ledger entries are immutable



Ledger state is the source of truth for payment eligibility



2.3 Payment Execution (If Enabled)



System verifies:



ledger balance matches consent



evidence pack exists and is complete



On failure:



payment halts



failure evidence is generated



no retries without human action



3\. Automation Boundaries



Automation is allowed, but never discretionary.



Allowed



Auto-selection of latest eligible spec only if:



user still explicitly acknowledges it



Automatic payment execution only after explicit consent



Forbidden



Computing under a spec the user has not acknowledged



Paying without ledger-specific consent



Silent retries or fallback behaviors



4\. Evidence Generation Points



Evidence must be generated at:



Spec acknowledgment



Computation execution



Lodgement authorization



Payment consent



Payment execution or failure



Each evidence artifact includes:



input hash



spec ID + version



period



system version (git SHA)



timestamp



human actor (where applicable)



Evidence is immutable and referenceable forever.



5\. Blocking \& Irreversibility Rules

Hard Blocks (Must Halt Execution)



Missing spec acknowledgment



Spec ambiguity or conflict



Missing or incomplete evidence



Payment consent mismatch



Irreversible Actions



Computation execution



Spec acknowledgment



Lodgement



Payment execution



UX must clearly distinguish:



reversible review states



irreversible execution states



6\. Deterministic Definitions (Audit-Critical)

6.1 Cycle Definition



A cycle is defined as:



a reporting period



computed under a single spec version



Spec changes do not affect an in-progress cycle.



Recomputation requires:



new acknowledgment



new evidence



explicit user action



6.2 Conflicting Specs



A conflict exists when:



more than one spec applies to the same jurisdiction + period



rules overlap without deterministic precedence



System response



hard stop



conflict evidence generated



no computation until resolved



6.3 Consent Validity



Consent is valid only for:



one ledger balance



one evidence pack



one execution



Consent:



cannot be reused



cannot be inferred



expires automatically once executed or invalidated



Final Position



APGMS is a deterministic execution and evidence system.



Humans:



choose inputs



approve specs



authorize lodgement



authorize payment



APGMS:



computes



records



evidences



refuses to act on ambiguity



This boundary is intentional and enforced.

