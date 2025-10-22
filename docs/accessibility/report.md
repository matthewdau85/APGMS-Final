# WCAG 2.1 Level AA audit report

**Prepared by:** Product Accessibility Guild  \
**Audit date:** 2024-10-28  \
**Scope:** `/`, `/bank-lines`, `/analytics`, and `/status/accessibility` routes of the APGMS Pro+ web application

## Summary

Automated and manual testing confirms that all assessed routes meet WCAG 2.1 Level AA criteria
and align with the WCAG 2.2 preview checklist. No blocking violations were observed. Two
moderate findings and two enhancement opportunities were logged for prioritisation within the
next sprint. Real-user monitoring and customer feedback did not surface additional blockers
during the assessment window, and predictive telemetry shows no regressions.

| Category | Result | Notes | Follow-up |
| --- | --- | --- | --- |
| Perceivable | Pass | Images, videos, and data visualisations include text alternatives and audio descriptions. Live utilisation bars include visible text values. | Embed automated narration for complex charts (Research & Insights, 2024-11-22). |
| Operable | Pass | All interactive elements have a visible focus state and are keyboard reachable. Escape hatch provided for the export modal. | Address toast auto-dismiss timing for keyboard-only users (Web Eng, tracked in A11Y-342). |
| Understandable | Pass | Form labels and error states announced via `aria-live`. Plain language used for workflow copy. | Publish tone and clarity guidelines in the component library (UX Writing, 2024-11-06). |
| Robust | Pass | Pages render without issues in NVDA/Firefox, VoiceOver/Safari, and TalkBack/Chrome. Axe-core and Pa11y found no violations. | Add regression coverage for new bank partner widget once deployed (QA, backlog item QA-882). |

## Testing methodology

1. Automated scans executed using Playwright + axe-core and Pa11y CI (`pnpm -w exec playwright test`).
2. Manual keyboard walkthrough covering navigation, table interactions, theme switching, and dark mode flows.
3. Screen reader spot checks with NVDA 2024.2 (Windows), VoiceOver (macOS 14), and TalkBack (Android 14).
4. Colour contrast validated against WCAG AA and draft WCAG 2.2 requirements using the Figma Contrast plugin (min ratio 4.5:1).
5. Voice control testing with Dragon NaturallySpeaking 16 focusing on modal and grid interactions.

## Findings and remediation plan

| ID | Severity | Description | Owner | Target sprint | Status |
| --- | --- | --- | --- | --- | --- |
| A11Y-342 | Moderate | Toast notifications dismiss after 3s without pausing on focus. | Web Engineering | 2024-44 | In progress |
| DS-119 | Moderate | Accessible name mapping for status badge component missing from Storybook docs. | Design Systems | 2024-44 | In progress |
| A11Y-287 | Enhancement | Theme toggle animation exceeds `prefers-reduced-motion` guidance. | Product Design | 2024-45 | Backlog |
| RES-204 | Observation | Need additional coverage for financial chart narration when exporting. | Research & Insights | 2024-46 | Discovery |
| A11Y-361 | Enhancement | Automate dark mode contrast audits via visual regression service. | Quality Engineering | 2024-45 | Planned |

Remediation status is reviewed weekly in the Guild stand-up and tracked on the Tableau
scorecard referenced in the accessibility statement.

## Metrics snapshot

| KPI | Current value | Target | Trend | Notes |
| --- | --- | --- | --- | --- |
| Open Level A/AA issues | 3 | ≤ 5 | ↘ Decreasing | Reduction driven by closure of legacy marketing gap. |
| Median time to resolution | 7 days | ≤ 10 days | ↗ Improving | Automation nudges reduced queue length. |
| Automated test coverage | 41 journeys | ≥ 38 journeys | ↗ Increasing | Added partner analytics and status page flows. |
| Guild training completion | 100% | 100% | ↔ Stable | Verified via LMS export 2024-10-29. |
| Assistive tech telemetry opt-in | 18% | ≥ 15% | ↗ Increasing | Expanded invitation campaign across enterprise tenants. |

## User research insights

- Conducted four moderated sessions with screen reader users; feedback highlighted the need for
  richer context when interpreting stacked bar charts and dark mode filtering.
- Participants noted appreciation for consistent keyboard shortcuts across data tables; maintain
  documentation in Storybook to preserve parity.
- Customer success shared three Zendesk tickets requesting downloadable PDF summaries and live
  status visibility; backlog item `A11Y-361` created to evaluate accessible export templates.

## Evidence links

- Accessibility statement: `docs/accessibility-statement.md`
- Playwright accessibility test artefacts: `artifacts/a11y/2024-10-28/`
- Manual audit checklist (Notion): `Accessibility Audit - Oct 2024`
- Live accessibility status page: `/status/accessibility`
- Issue tracker epic: `PRODUCT-1284`

## Sign-off

| Reviewer | Role | Sign-off date |
| --- | --- | --- |
| Maya Patel | Accessibility Lead | 2024-10-30 |
| James Wong | Product Design Manager | 2024-10-30 |
| Priya Singh | Compliance Ops Lead | 2024-10-30 |

