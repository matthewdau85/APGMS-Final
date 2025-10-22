# APGMS GUI Design Playbook

## Purpose
This playbook translates the APGMS patent requirements into an implementable product surface that fits inside the existing Pro+ web shell (`App.tsx`). The goal is to reuse global layout, routing, and theming while defining the screens, components, and interaction patterns needed to manage PAYGW and GST obligations with strong compliance guarantees.【F:webapp/src/App.tsx†L1-L64】

## Anchor on proven shell primitives
* **App frame** – Continue using the header / nav / content / footer scaffold so new PAYGW and GST views inherit responsive padding, theme switching, and navigation affordances.【F:webapp/src/App.tsx†L33-L64】【F:webapp/src/App.css†L1-L78】
* **Design tokens** – Map patent concepts (PAYGW balances, GST variance alerts, compliance badges) to the existing color, spacing, radius, typography, and status badge tokens to guarantee consistency in both light and dark themes.【F:webapp/src/styles/tokens.css†L1-L74】【F:webapp/src/styles/global.css†L1-L72】
* **Accessibility baselines** – Respect the global focus, typography, and badge conventions that already meet WCAG AA contrast targets.【F:webapp/src/styles/global.css†L1-L72】

## Core workflows
1. **Tax obligation forecasting** – Provide executives an overview of PAYGW and GST balances versus calculated liabilities to ensure funds in designated one-way accounts will clear at BAS lodgment.
2. **Variance investigation** – Allow operations staff to inspect discrepancies between secured balances and calculated obligations, escalate alerts, and document remediation steps before transfers are blocked.
3. **Compliance evidence** – Equip finance leaders with audit trails, payment plan statuses, and remission requests for ATO engagement.
4. **Integration health** – Surface the real-time status of payroll, banking, POS, and ATO connections along with fraud detection signals.

Each workflow should be reachable from the global nav with page-level headings for screen-reader orientation and consistent breadcrumbing inside the content column.

## Screen blueprint
| Screen | Purpose | Key modules | Notes |
| --- | --- | --- | --- |
| **Obligation Overview** | Executive control room for PAYGW + GST at-a-glance | Metric cards (balances vs liabilities, variance delta, next BAS due date), trend spark-lines, status badges for overall compliance posture | Extend the `metric-card` pattern from `HomePage` to display PAYGW/GST metrics. Use `--status-*` tokens to mark _On Track_, _Monitoring_, or _Action Required_.【F:webapp/src/pages/Home.tsx†L4-L76】【F:webapp/src/styles/tokens.css†L44-L63】 |
| **PAYGW Flow Manager** | Monitor payroll integrations, secured balances, and upcoming lodgments | Integration health table, discrepancy queue, action drawer for remediation steps | Include filters for payroll cycles; align column spacing with `--spacing-md`. Emphasize blocked transfers with `--color-danger` backgrounds on row badges.【F:webapp/src/styles/tokens.css†L11-L17】 |
| **GST Reconciliation** | Validate GST captured from POS against ledger totals | Transaction variance heatmap, discrepancy resolution wizard, documentation upload | Provide stepper UI that logs resolution notes into audit trail; highlight shortfalls using warning tokens. |
| **Compliance & Remissions** | Manage alerts, penalty warnings, ATO payment plans | Timeline of alerts, document repository, automated report exports | Use card sections for _Pre-lodgment alerts_, _Penalty notices_, _Remission requests_. |
| **Security & Fraud Watch** | Display MFA status, encryption posture, fraud detection results | Connection cards, anomaly feed, configurable thresholds | Offer inline toggles with descriptive help text for alerts, honoring focus outlines for keyboard control. |

## Interaction and data states
* **Variance alerts** – Present as dismissible cards anchored at the top of PAYGW/GST screens. Use `--color-warning` for pending discrepancies and escalate to `--color-danger` once transfers are blocked.【F:webapp/src/styles/tokens.css†L11-L17】
* **Discrepancy workflow** – Wizard captures issue classification, remediation option (adjust secured funds, reschedule, request payment plan), and evidence attachments. Progress is saved automatically; show inline checklist summarizing patent-mandated steps (alert, investigation, resolution, documentation).
* **Audit trail log** – Table with filter chips for _PAYGW_, _GST_, _Security_, _Compliance_. Each entry includes timestamp, integration source, action, and outcome. Provide export to CSV / PDF for ATO submissions.
* **Integration status chips** – Apply status badges with label + hint (e.g., `Payroll API` / `Synced 5m ago`). Use semantic tokens for color-coded states while maintaining accessible hint text sizing per global styles.【F:webapp/src/styles/global.css†L35-L72】

## Navigation model
* Extend the primary nav with tabs for **Obligations**, **PAYGW**, **GST**, **Compliance**, **Security**. When information density exceeds available width (≤800px), stack navigation per responsive breakpoints already defined in `App.css` to preserve tap targets.【F:webapp/src/App.css†L54-L77】
* Within each page, use secondary tab bars or left-hand sub-navigation only if a workflow requires multiple sub views (e.g., _Variance queue_ vs _Historical reports_). Maintain route parity with React Router to keep deep links shareable.

## Data visualization patterns
* **Trend charts** – Favor compact spark-lines for high-level trend plus accessible textual summaries (`aria-describedby`). Provide toggle for table view to meet screen-reader needs.
* **Progress rings** – Show percentage of secured funds vs liability. Use primary color for on-track, warning/danger for underfunded states. Ensure stroke width matches radius tokens for visual balance.
* **Heatmap cards** – For GST variance by location or product, keep grid cells large enough to meet 44px touch targets. Provide textual legend and keyboard navigation support.

## Compliance-first content strategy
* Highlight the automatic nature of designated one-way accounts and BAS-triggered transfers in page hero copy and tooltips.
* Default to chronological narratives for discrepancy timelines to mirror the patent’s emphasis on due diligence documentation.
* Offer quick links to educational resources (FAQs, tutorials) inside the Compliance screen to promote proactive engagement.

## Accessibility checklist
* All interactive controls receive focus styles inherited from the theme tokens; avoid overriding `outline` except to increase visibility.【F:webapp/src/styles/global.css†L1-L32】
* Provide aria-live regions for real-time alerts (shortfalls, fraud anomalies) so assistive tech users receive updates promptly.
* Ensure charts include descriptive text alternatives and color-independent patterns for status communication.

## Implementation sequencing
1. **Scaffold routes and nav** – Define React Router paths and extend the header nav. Create placeholder pages to validate theming and responsive behavior.
2. **Build overview metrics** – Repurpose Home page metric cards for PAYGW/GST balances with new data props.
3. **Implement variance queues** – Create reusable table component with badge states and remediation drawers.
4. **Layer compliance tooling** – Add audit trail, document attachments, and reporting exports.
5. **Finalize accessibility** – Test keyboard flows, color contrast, aria attributes, and theme parity.

## Success criteria
* Users can confirm PAYGW/GST funding readiness for the upcoming BAS in under two interactions.
* Discrepancy alerts capture root cause, remediation choice, and supporting notes in a single flow.
* Compliance reports export with one click and include the data required for ATO payment plan negotiations.
* All screens maintain ≥ WCAG 2.1 AA contrast in both light and dark modes using existing tokens.
