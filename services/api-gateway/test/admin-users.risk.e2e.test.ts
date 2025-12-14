import Fastify from "fastify";
import makeAdminUsersPlugin from "../src/routes/admin-users.js";
import type { RiskDeleteStore } from "@apgms/shared";

describe("admin delete user risk behaviour (e2e)", () => {
  it("constraint risk -> anonymise rather than hard delete", async () => {
    const app = Fastify();

    const riskStore: RiskDeleteStore = {
      async check() {
        return {
          action: "ANONYMISE",
          reason: "Constraints present; retained records require anonymisation",
        };
      },
    };

    await app.register(makeAdminUsersPlugin, {
      riskStore,
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/admin/users/user-123",
      headers: {
        "x-org-id": "org-1",
        "x-actor": "admin-1",
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({
      action: "ANONYMISED",
      reason: "Constraints present; retained records require anonymisation",
    });

    await app.close();
  });
});
