import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "3s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const BASE = __ENV.API_BASE_URL || "http://127.0.0.1:3000";

export default function () {
  const r1 = http.get(`${BASE}/ready`);
  check(r1, { "GET /ready is 200": (res) => res.status === 200 });

  // If /health exists, great; if not, do not fail the whole smoke.
  const r2 = http.get(`${BASE}/health`);
  check(r2, { "GET /health is 200 or 404": (res) => res.status === 200 || res.status === 404 });

  sleep(1);
}
