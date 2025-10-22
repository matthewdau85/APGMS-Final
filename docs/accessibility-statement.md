# Accessibility Statement

## Our Commitment

APGMS is committed to delivering a digital experience that is inclusive and usable for everyone.
Our goal is to exceed the [Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/)
Level AA criteria across our customer and partner experiences and to pilot WCAG 2.2 success
criteria ahead of formal adoption.

## Scope

This statement covers the APGMS public marketing site, authenticated customer experiences, the
customer assurance portal, and supporting documentation delivered through the APGMS web
application. Automated accessibility tests are executed on key user journeys, including the
home page, bank lines workflow, accessibility status page, and partner analytics exports.

## Testing approach

We evaluate accessibility on an ongoing basis using automated testing (Playwright with axe-core
and Pa11y CI), manual review, and live assistive technology sessions. Automated checks are part
of our continuous integration pipeline and run on every change, with blocking gates enforced in
GitHub Actions and preview environments. Manual spot checks cover keyboard navigation, screen
reader compatibility, colour contrast, and voice control scenarios. Every release that introduces
a new component requires a paired design-engineering review using the accessibility checklist
maintained in Figma, plus a design token validation against the Storybook accessibility audit panel.

## Monitoring and measurement

- **CI coverage:** Accessibility tests must pass in GitHub Actions before merge. Failures
  automatically file Jira bugs tagged `a11y-blocker` and block deployments until resolved.
- **Dashboard:** The accessibility scorecard in Tableau tracks the count of open Level A/AA
  issues, time-to-resolution, audit cadence, and predictive backlog burn-down by product area.
- **Quarterly audits:** The Product Accessibility Guild conducts quarterly manual audits, with
  interim spot checks triggered by telemetry alerts, and shares findings in the `Accessibility-QBR`
  Confluence space.
- **User feedback loop:** The in-product accessibility widget routes comments to Zendesk with
  an SLA of one business day for triage and linkage to backlog items, and anonymised summaries
  appear on the public accessibility status page.
- **Executive reporting:** Monthly compliance scorecard highlights accessibility KPIs alongside
  privacy and security metrics, and the Snowflake data share extends visibility to strategic partners.
  A PDF copy of each scorecard is archived at `artifacts/compliance/` for transparency reviews.
- **Real-user monitoring:** Opt-in assistive technology telemetry tracks keyboard-only journeys
  and alert thresholds for regression detection.

## Roles and responsibilities

- **Product Design** maintains accessible design patterns and audits new components.
- **Engineering** ensures semantic markup, keyboard support, and compliance with WCAG criteria.
- **Quality Engineering** owns automated a11y test suites, regression dashboards, and the
  synthetic user journeys executed from multiple geographies.
- **Customer Success** routes accessibility feedback to the product backlog within two business days.
- **People Operations** ensures onboarding and annual refresher training covers accessibility
  expectations for product, engineering, and design roles.
- **Research & Insights** coordinates moderated sessions with assistive technology users at
  least quarterly, feeds insights into the roadmap, and maintains the accessibility research
  repository.
- **Vendor Management** evaluates third-party components for WCAG compliance prior to procurement
  and tracks exceptions in the vendor register.

## Improvement roadmap

| Milestone | Description | Owner | Target date |
| --- | --- | --- | --- |
| A11Y-2024-11 | Publish component-level accessibility annotations in Storybook with automated token validation. | Design Systems | 2024-11-12 |
| A11Y-2024-12 | Launch self-service accessibility feedback widget in the webapp footer with localisation support. | Web Engineering | 2024-12-05 |
| A11Y-2025-01 | Conduct usability testing with screen reader participants on partner analytics and dark mode flows. | Research & Insights | 2025-01-15 |
| A11Y-2025-02 | Ship live accessibility status page with current KPIs, backlog summaries, and RUM trends. | Product Accessibility Lead | 2025-02-07 |
| A11Y-2025-03 | Complete WCAG 2.2 success criteria gap analysis and remediation plan. | Accessibility Guild | 2025-03-14 |

## Known limitations

- Legacy marketing content has been remediated and now includes complete alternative text and
  descriptive captions.
- User-generated documents uploaded to the platform may not yet meet WCAG 2.1 AA standards. We
  provide guidance to authors and continue to improve document templates.
- Third-party widgets embedded in dashboards may not fully support keyboard navigation. We are
  collaborating with providers to enhance accessibility or identify alternatives.
- Complex financial charts may require additional textual summaries for users relying on screen readers;
  automated narrative descriptions are now in pilot with release tracking under `A11Y-361`.

If you encounter an issue that is not listed above, please let us know so that we can address it promptly.

## Feedback and Contact

We welcome your feedback on the accessibility of APGMS. Please contact the APGMS Accessibility team
at [accessibility@apgms.example](mailto:accessibility@apgms.example) with questions, suggestions, or
to request alternate formats for any content. We aim to respond within five business days.

## Statement updates

This statement was last reviewed on 01 November 2024 by the Product Accessibility Guild. We review
and update it at least quarterly, or sooner if significant changes are made to our products. The
detailed audit log is available in [`docs/accessibility/report.md`](accessibility/report.md). Meeting
minutes and action items are stored in Confluence `Accessibility-Guild`. The next scheduled review
is 15 January 2025 with a focus on third-party integrations, complex data visualisations, and
WCAG 2.2 readiness.

