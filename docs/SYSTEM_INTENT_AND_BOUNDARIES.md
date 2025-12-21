\# APGMS — System Intent and Boundaries



\## Purpose



This document defines the \*\*explicit intent, scope, and boundaries\*\* of the APGMS system.



It exists to prevent:

\- scope creep

\- misinterpretation of system responsibility

\- unintended legal or regulatory risk

\- ambiguity during audit or review



This document is authoritative.



---



\## What APGMS Is



\### A Deterministic Execution Engine



APGMS is a \*\*deterministic execution system\*\*.



Given the same:

\- inputs

\- tax specification

\- system version



APGMS will always produce the \*\*same outputs\*\*.



There is no probabilistic behaviour, inference, or discretion in execution.



---



\### Computes Obligations from Explicit Tax Specifications



APGMS computes tax obligations \*\*only\*\* from:

\- explicit, human-approved tax specifications (“tax specs”)

\- clearly defined inputs for a given period and entity



Tax specs define:

\- rates

\- thresholds

\- formulas

\- applicability rules



APGMS does not invent, infer, or guess tax rules.



---



\### Produces Explainable Outputs and Evidence



Every computation performed by APGMS produces:

\- explainable outputs (what was calculated and why)

\- traceable intermediate values

\- immutable ledger records

\- exportable evidence artefacts



All outputs are designed to be:

\- reviewable

\- replayable

\- auditable



---



\## What APGMS Is Not



\### APGMS Does NOT Interpret Law



APGMS does not read, interpret, or reason about legislation.



Legal interpretation occurs \*\*outside the system\*\* and is embodied in tax specs approved by humans.



---



\### APGMS Does NOT Infer Missing Rules



If required tax rules are missing, incomplete, or ambiguous:

\- APGMS will \*\*fail explicitly\*\*

\- no computation will proceed



APGMS does not attempt to “fill gaps” or make assumptions.



---



\### APGMS Does NOT Auto-Ingest Legislation



APGMS does not:

\- scrape legislation

\- ingest regulatory updates automatically

\- update rules without human approval



All tax specs are introduced and activated through governed human processes.



---



\### APGMS Does NOT Make Discretionary Decisions



APGMS does not exercise judgment.



It does not:

\- choose between alternative interpretations

\- optimise for outcomes

\- override rules based on context



It executes exactly what it is given.



---



\## Execution Model



APGMS operates using the following immutable execution pipeline:





