import Fastify from "fastify";
import adminUsersPlugin from "../src/routes/admin-users.js";
import { prototypeAdminGuard } from "../src/guards/prototype-admin.js";

describe("admin delete user risk behaviour (e2e)", () => {
  it("records anonymisation risk event and returns 202", async () => {
    const app = Fastify({ logger: false });

    const events: any[] = [];

    await app.register(async (proto) => {
      proto.addHook("preHandler", prototypeAdminGuard());
      await proto.register(
        adminUsersPlugin,
        {
          prefix: "/admin",
          riskStore: {
            async recordRiskEvent(event: any) {
              events.push(event);
            },
          },
        } as any
      );
    });

    await app.ready();

    const res = await app.inject({
      method: "DELETE",
      url: "/admin/users/user-123",
      headers: {
        authorization: "Bearer admin-token",
        "x-prototype-admin": "1",
        "x-org-id": "org-1",
        "x-actor": "admin-1",
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ ok: true });

    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
      orgId: "org-1",
      actor: "admin-1",
      entityId: "user-123",
      action: "USER_DELETE_REQUESTED",
    });

    await app.close();
  });
});
