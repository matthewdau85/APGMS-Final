# Accessibility Evidence

- Automated WCAG 2.1 A/AA scans are executed with `@axe-core/playwright` in [`webapp/tests/a11y.spec.ts`](../../../webapp/tests/a11y.spec.ts) and [`webapp/tests/axe.spec.ts`](../../../webapp/tests/axe.spec.ts).
- Each spec blocks on `page.waitForLoadState('networkidle')` before asserting `results.violations` is an empty array, providing deterministic evidence of "no violations" for the home and bank lines views.
- Playwright artifacts are attached per route, capturing the underlying JSON from Axe for auditors to review alongside CI logs.
