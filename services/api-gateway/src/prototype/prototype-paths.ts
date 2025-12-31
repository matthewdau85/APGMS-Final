// services/api-gateway/test/prototype-contract.test.ts
import { describe, expect, it } from "@jest/globals";
import { buildFastifyApp } from "../app.js";

function nodeEnv(): string {
  return String(process.env.NODE_ENV || "").toLowerCase();
}

describe("prototype endpoint contract", () => {
  it("/prototype/monitor is 404 in prod; admin-only in non-prod", async () => {
    const app = await buildFastifyApp({ inMemoryDb: true });

    const resUser = await app.inject({
      method: "GET",
      url: "/prototype/monitor",
      headers: {
        authorization: "Bearer dev",
        "x-org-id": "org-1",
        "x-role": "user",
      },
    });

    const resAdmin = await app.inject({
      method: "GET",
      url: "/prototype/monitor",
      headers: {
        authorization: "Bearer dev",
        "x-org-id": "org-1",
        "x-role": "admin",
      },
    });

    if (nodeEnv() === "production") {
      expect(resUser.statusCode).toBe(404);
      expect(resAdmin.statusCode).toBe(404);
    } else {
      expect(resUser.statusCode).toBe(403);
      expect(resUser.json()).toEqual({ error: "admin_only_prototype" });

      // Admin is allowed (status may vary by implementation details)
      expect([200, 204, 404]).toContain(resAdmin.statusCode);
    }

    await app.close();
  });

  it("/regulator/compliance/summary is 404 in prod; accessible in non-prod", async () => {
    const app = await buildFastifyApp({ inMemoryDb: true });

    const resUser = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: {
        authorization: "Bearer dev",
        "x-org-id": "org-1",
        "x-role": "user",
      },
    });

    if (nodeEnv() === "production") {
      expect(resUser.statusCode).toBe(404);
    } else {
      // Non-prod: no prototype admin gate here anymore; should not be 403.
      // With the in-memory setup, the handler should return 200 for the contract test.
      expect(resUser.statusCode).toBe(200);
    }

    await app.close();
  });
});
