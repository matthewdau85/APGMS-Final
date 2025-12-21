

\### Key Properties



\- Each step is explicit and inspectable

\- Intermediate state is traceable

\- Failures halt execution safely

\- Side effects are controlled and auditable



---



\### Determinism Guarantee



For any execution:



\- identical inputs

\- identical tax spec version

\- identical system version



will always yield:



\- identical outputs

\- identical ledger entries

\- identical evidence artefacts



---



\## Human Responsibility Boundary



APGMS is a tool. Humans remain responsible for decisions.



\### Humans Approve Tax Specifications



Humans are responsible for:

\- authoring tax specs

\- reviewing correctness

\- approving activation



APGMS enforces the existence of approval metadata but does not judge correctness.



---



\### Humans Select Periods



Humans choose:

\- reporting periods

\- correction periods

\- amendment timing



APGMS executes only within the selected scope.



---



\### Humans Decide When to Lodge or Pay



APGMS may calculate obligations, but:

\- lodgement decisions

\- payment timing

\- enforcement actions



remain human decisions outside the system.



---



\## Summary



APGMS is a \*\*deterministic execution and evidence system\*\*, not a legal authority.



Its design prioritises:

\- predictability

\- explainability

\- auditability

\- conservative failure



This boundary is intentional and enforced.



