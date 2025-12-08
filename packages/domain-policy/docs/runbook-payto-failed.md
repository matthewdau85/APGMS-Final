\# Runbook – PayTo BAS Settlement Failure



\## Symptom



\- A BAS settlement instruction is stuck in `FAILED` status.

\- PayTo gateway or bank callback indicates a failure (insufficient funds, mandate cancelled, technical error).

\- Merchant or org reports that a BAS debit did not occur when expected.



\## Quick Facts



\- Model: `settlementInstruction`

\- Channel: `PAYTO`

\- Relevant fields: `orgId`, `period`, `status`, `payloadJson`, `failureReason`, timestamps.



\## 1. Confirm the failure



1\. Find the settlement record:



&nbsp;  ```sql

&nbsp;  SELECT \*

&nbsp;  FROM "settlementInstruction"

&nbsp;  WHERE id = '<instruction-id>';



