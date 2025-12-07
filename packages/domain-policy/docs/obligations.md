\# Period Obligations – Domain Contract



\## Purpose



Compute the statutory PAYGW and GST obligations for an organisation over a given period, based on ledger-compatible inputs (payroll, POS, and manual adjustments).



\## Input



\- `orgId: string`

\- `period: string` – a logical BAS period.

&nbsp; - For v1 we treat this as an opaque string (e.g. `"2025-Q3"` or `"2025-09"`).

&nbsp; - All callers must agree on a shared format; we will later centralise this in a `BasPeriod` helper.



\## Output



```ts

export interface PeriodObligations {

&nbsp; paygwCents: number;

&nbsp; gstCents: number;

&nbsp; breakdown?: {

&nbsp;   source: "PAYROLL" | "POS" | "MANUAL";

&nbsp;   amountCents: number;

&nbsp; }\[];

}


For v1, we will use `YYYY-Qn` (e.g. `2025-Q3`) for all BAS-related endpoints and domain calls.



