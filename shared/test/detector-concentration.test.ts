import assert from "node:assert/strict";
import { test } from "node:test";

import {
  aggregateDetectorConcentration,
  isDetectorConcentration,
  type DetectorFlaggedRow,
} from "../src/monitoring/detector-concentration.js";

test("aggregateDetectorConcentration ranks vendors and approvers", () => {
  const rows: DetectorFlaggedRow[] = [
    { vendor: "Acme Pty Ltd", approver: "J. Smith" },
    { vendor: "Acme Pty Ltd", approver: "J. Smith" },
    { vendor: "Acme Pty Ltd", approver: "A. Brown" },
    { vendor: "Brightside Consulting", approver: "A. Brown" },
    { vendor: "Brightside Consulting", approver: "J. Smith" },
    { vendor: "Northwind", approver: "S. Reed" },
    { vendor: "northwind", approver: "S. Reed" },
    { vendor: "Northwind", approver: "S. Reed" },
  ];

  const result = aggregateDetectorConcentration(rows, { limit: 2 });

  assert.equal(result.totalFlagged, rows.length);
  assert.deepEqual(result.vendorShare.map((item) => item.name), [
    "Acme Pty Ltd",
    "Northwind",
  ]);
  assert.equal(result.vendorShare[0].count, 3);
  assert.equal(result.vendorShare[0].percentage, Number(((3 / rows.length) * 100).toFixed(1)));

  assert.deepEqual(result.approverShare.map((item) => item.name), [
    "J. Smith",
    "S. Reed",
  ]);
  assert.equal(result.approverShare[0].count, 3);
});

test("aggregateDetectorConcentration handles empty or missing values", () => {
  const rows: DetectorFlaggedRow[] = [
    { vendor: "", approver: null },
    { vendor: null, approver: "" },
  ];

  const result = aggregateDetectorConcentration(rows);
  assert.equal(result.vendorShare.length, 0);
  assert.equal(result.approverShare.length, 0);
});

test("isDetectorConcentration recognises valid payloads", () => {
  const valid = aggregateDetectorConcentration([]);
  assert.ok(isDetectorConcentration(valid));
  assert.ok(!isDetectorConcentration(null));
  assert.ok(!isDetectorConcentration({ totalFlagged: 1 }));
});
