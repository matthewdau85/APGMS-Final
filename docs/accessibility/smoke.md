# Accessibility Smoke Tests

Run the Playwright accessibility suite headlessly:

```
pnpm -r test --filter @apgms/webapp test:axe
```

CI executes `pnpm -r test` which includes `webapp/test:axe`; ensure Chromium dependencies are installed with `pnpm exec playwright install --with-deps` locally.

