

\### Lifecycle Rules



\- Only Approved specs may be Scheduled

\- Only Scheduled specs may become Active

\- Archived specs remain immutable and referenceable



---



\## Execution Safeguards



APGMS \*\*refuses to compute\*\* if:



\- a required tax spec is missing

\- a tax spec is ambiguous

\- multiple active tax specs conflict

\- approval metadata is missing or invalid



Failure is explicit and non-destructive.



---



\## Summary



Tax specs are the \*\*single source of truth\*\* for tax rules in APGMS.



Governance is enforced through:

\- explicit roles

\- immutable versions

\- conservative activation rules

\- explicit failure on ambiguity



This design prioritises safety over convenience.



