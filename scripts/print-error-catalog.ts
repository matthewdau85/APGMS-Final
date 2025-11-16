#!/usr/bin/env tsx
import { listErrorCatalog } from "../shared/src/errors/catalog.js";

const catalog = listErrorCatalog().map((entry) => ({
  code: entry.code,
  domain: entry.domain,
  status: entry.httpStatus,
  severity: entry.severity,
  retryable: entry.retryable,
  remediation: entry.remediation ?? "",
}));

console.table(catalog);
