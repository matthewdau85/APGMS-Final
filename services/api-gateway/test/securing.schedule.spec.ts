import assert from "node:assert/strict";
import { test } from "node:test";
import { Decimal } from "@prisma/client/runtime/library";

import { aggregatePendingContributionBatches } from "../../../shared/src/ledger/ingest.ts";

test("weekly schedule defers current week contributions", () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const entries = [
    {
      id: "wk-1",
      amount: new Decimal(1_000),
      createdAt: new Date("2025-01-03T10:00:00Z"),
      source: "payroll_system",
    },
    {
      id: "wk-2",
      amount: new Decimal(2_000),
      createdAt: new Date("2025-01-05T09:00:00Z"),
      source: "payroll_system",
    },
    {
      id: "wk-current",
      amount: new Decimal(500),
      createdAt: new Date("2025-01-14T09:00:00Z"),
      source: "payroll_system",
    },
  ];
  const batches = aggregatePendingContributionBatches(entries, "weekly", now);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].contributionIds.sort(), ["wk-1", "wk-2"]);
  assert.equal(Number(batches[0].totalAmount.toString()), 3000);
});

test("daily schedule only aggregates completed days", () => {
  const now = new Date("2025-03-10T06:00:00Z");
  const entries = [
    {
      id: "d1-a",
      amount: new Decimal(100),
      createdAt: new Date("2025-03-08T10:00:00Z"),
      source: "gst_system",
    },
    {
      id: "d1-b",
      amount: new Decimal(50),
      createdAt: new Date("2025-03-08T18:00:00Z"),
      source: "gst_system",
    },
    {
      id: "d2",
      amount: new Decimal(200),
      createdAt: new Date("2025-03-09T03:00:00Z"),
      source: "gst_system",
    },
    {
      id: "d-current",
      amount: new Decimal(400),
      createdAt: new Date("2025-03-10T02:00:00Z"),
      source: "gst_system",
    },
  ];
  const batches = aggregatePendingContributionBatches(entries, "daily", now);
  assert.equal(batches.length, 2);
  assert.equal(Number(batches[0].totalAmount.toString()), 150);
  assert.deepEqual(batches[0].contributionIds.sort(), ["d1-a", "d1-b"]);
  assert.equal(Number(batches[1].totalAmount.toString()), 200);
  assert.deepEqual(batches[1].contributionIds, ["d2"]);
});
