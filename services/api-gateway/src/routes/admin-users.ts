// test/admin-users.risk.e2e.test.ts
import buildServer from "../src/app.js";

describe("admin delete user risk behaviour (e2e)", () => {
  it("constraint risk -> anonymise rather than hard delete", async () => {
    const recordedEvents: any[] = [];

    const app = await buildServer({
      adminUsers: {
        riskStore: {
          async recordRiskEvent(event) {
            recordedEvents.push(event);
          },
        },
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/admin/users/user-123",
      headers: {
        authorization: "Bearer admin-token",
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(202);

    expect(res.json()).toEqual({
      action: "ANONYMISED",
      reason: "Constraints present; retained records require anonymisation",
    });

    expect(recordedEvents).toContainEqual(
      expect.objectContaining({
        orgId: "org-1",
        entityId: "user-123",
        action: "ANONYMISED",
      }),
    );
  });
});
