import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 2,
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

const BASE_URL = __ENV.BASE_URL ?? "http://localhost:3000";
const READY_URL = `${BASE_URL}/ready`;
const HEALTH_URL = `${BASE_URL}/health`;

export default function () {
  const health = http.get(HEALTH_URL);
  check(health, {
    "health responds 200": (res) => res.status === 200,
    "health body ok": (res) => res.json("ok") === true,
  });

  const ready = http.get(READY_URL);
  check(ready, {
    "ready responds 200": (res) => res.status === 200,
    "ready payload ready": (res) => res.json("ready") === true,
  });

  sleep(1);
}
