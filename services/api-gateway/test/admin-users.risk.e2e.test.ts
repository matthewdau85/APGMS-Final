import Fastify from "fastify";
import { makeAdminUsersPlugin } from "../src/routes/admin-users.js";

describe("admin delete user risk behaviour (e2e)", () => {
  it("constraint risk -> anonymise rather than hard delete", async () => {
    const calls: string[] = [];

    const app = Fastify({ logger: false });
    await app.register(
      makeAdminUsersPlugin({
        riskStore: {
          hasConstraints: async () => true,
          anonymiseUser: async () => calls.push("anonymise"),
          hardDeleteUser: async () => calls.push("hardDelete"),
        },
      }) as any
    );
    await app.ready();

    const res = await app.inject({
      method: "DELETE",
      url: "/admin/users/user-1",
      headers: { authorization: "Bearer test" }, // your authGuard in test mode only checks presence
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({
      action: "ANONYMISED",
      reason: "Constraints present; retained records require anonymisation",
    });
    expect(calls).toEqual(["anonymise"]);

    await app.close();
  });
});
