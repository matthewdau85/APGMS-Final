#!/usr/bin/env node
import process from "node:process";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const CHAOS_QUEUE = process.env.CHAOS_QUEUE ?? "bas-settlements";

function log(message) {
  console.log(`[chaos] ${message}`);
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function httpRequest(path, options = {}) {
  const { parse = "json", ...fetchOptions } = options;
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, fetchOptions);
  const text = await response.text();
  if (parse === "text") {
    return { status: response.status, body: text, headers: response.headers };
  }
  if (!text) {
    return { status: response.status, body: null, headers: response.headers };
  }
  try {
    return { status: response.status, body: JSON.parse(text), headers: response.headers };
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${path}: ${error}`);
  }
}

async function waitForReady(expectedOk, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status, body } = await httpRequest("/ready");
    const ready = status === 200 && body?.ok === true;
    const failing = status >= 500 && body?.ok === false;
    if (expectedOk && ready) {
      return { status, body };
    }
    if (!expectedOk && failing) {
      return { status, body };
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for readiness ${expectedOk ? "success" : "failure"}`);
}

function extractQueueGauge(metricsText, queue) {
  const pattern = new RegExp(`apgms_queue_backlog_depth\\{queue="${queue}"\\} ([0-9.eE+-]+)`);
  const match = metricsText.match(pattern);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

async function main() {
  log(`Dependency outage drill against ${API_BASE_URL}`);

  const baseline = await waitForReady(true, 15000);
  ensure(baseline.body?.components?.db === true, "Baseline readiness missing DB component");
  log("Baseline readiness confirmed (db, redis, nats)");

  log("Simulating database outage");
  const down = await httpRequest("/__chaos/dependencies/db/down", { method: "POST" });
  ensure(down.status === 200, "Failed to request DB outage toggle");

  const outage = await waitForReady(false, 20000);
  ensure(outage.status === 503, "Expected readiness to fail with 503 during DB outage");
  ensure(outage.body?.components?.db === false, "Readiness payload did not indicate DB failure");
  log("Readiness failure observed as expected");

  log("Restoring database connectivity");
  const up = await httpRequest("/__chaos/dependencies/db/up", { method: "POST" });
  ensure(up.status === 200, "Failed to request DB recovery toggle");

  const recovered = await waitForReady(true, 20000);
  ensure(recovered.status === 200, "Expected readiness to recover to 200");
  log("Readiness recovery confirmed");

  log(`Simulating queue backlog on ${CHAOS_QUEUE}`);
  const backlog = await httpRequest("/__chaos/queues/backlog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queue: CHAOS_QUEUE, depth: 275, reason: "nightly-drill" }),
  });
  ensure(backlog.status === 200, "Failed to set queue backlog");

  const metricsSnapshot = await httpRequest("/metrics", { parse: "text" });
  const backlogValue = extractQueueGauge(metricsSnapshot.body ?? "", CHAOS_QUEUE);
  ensure(backlogValue === 275, `Expected backlog gauge to equal 275, saw ${backlogValue}`);
  log("Queue backlog gauge registered");

  log("Clearing queue backlog");
  const recoveredQueue = await httpRequest("/__chaos/queues/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queue: CHAOS_QUEUE, reason: "nightly-drill" }),
  });
  ensure(recoveredQueue.status === 200, "Failed to clear queue backlog");

  const metricsAfter = await httpRequest("/metrics", { parse: "text" });
  const backlogAfter = extractQueueGauge(metricsAfter.body ?? "", CHAOS_QUEUE);
  ensure(backlogAfter === 0, `Expected backlog gauge to reset to 0, saw ${backlogAfter}`);
  log("Queue backlog gauge reset confirmed");

  const eventsResponse = await httpRequest("/__chaos/events");
  const events = eventsResponse.body?.events ?? [];
  ensure(Array.isArray(events) && events.length > 0, "Expected chaos events to be recorded");

  const dbOutageEvent = events.find((event) => event?.detail?.includes("Database marked unavailable"));
  const dbRecoveryEvent = events.find((event) => event?.detail?.includes("Database connectivity restored"));
  const queueOutageEvent = events.find((event) => event?.detail?.includes(`Queue backlog simulated for ${CHAOS_QUEUE}`));
  const queueRecoveryEvent = events.find((event) => event?.detail?.includes(`Queue backlog cleared for ${CHAOS_QUEUE}`));

  ensure(dbOutageEvent, "Missing database outage event");
  ensure(dbRecoveryEvent, "Missing database recovery event");
  ensure(queueOutageEvent, "Missing queue backlog event");
  ensure(queueRecoveryEvent, "Missing queue recovery event");
  log("Chaos event log includes outage and recovery markers");

  log("Dependency outage drill complete");
}

main().catch((error) => {
  console.error("[chaos] drill failed");
  console.error(error);
  process.exit(1);
});
