import jwt from "jsonwebtoken";
import { buildFastifyApp } from "../src/app.js";
import { registerAuth } from "../src/plugins/auth.js";

const isProd = process.env.NODE_ENV === "production";
const AUTH_SECRET = "test-secret";

function signToken(orgId: string) {
  return jwt.sign(
    { orgId, role: "regulator", sub: "reg-1" },
    AUTH_SECRET,
    { algorithm: "HS256", expiresIn: "5m" },
  );
}

(isProd ? describe.skip : describe)("/regulator/compliance/summary e2e", () => {
  it("falls back to deterministic org in non-production when x-org-id is missing", async () => {
    process.env.AUTH_DEV_SECRET = AUTH_SECRET;
    const app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: {
        authorization: `Bearer ${signToken("org-1")}`,
        // intentionally no x-org-id
      },
    });

    expect(res.statusCode).toBe(200);

    const body: any = res.json();
    expect(body).toBeTruthy();
    expect(body.orgId).toBe("org_1");
    expect(body.period).toBe("2025-Q1");

    await app.close();
  });

  it("returns HIGH risk when ledger is empty but obligations exist", async () => {
    process.env.AUTH_DEV_SECRET = AUTH_SECRET;
    const app = buildFastifyApp({ inMemoryDb: true });
    await registerAuth(app);
    await app.ready();

    // Seed obligations so ledger=0 implies HIGH risk.
    const db: any = (app as any).db;
    await db.payrollItem.create({
      data: { orgId: "org-1", period: "2025-Q1", paygwCents: 1000 },
    });
    await db.gstTransaction.create({
      data: { orgId: "org-1", period: "2025-Q1", gstCents: 500 },
    });

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q1",
      headers: {
        "x-org-id": "org-1",
        authorization: `Bearer ${signToken("org-1")}`,
      },
    });

    expect(res.statusCode).toBe(200);

    const body: any = res.json();
    expect(body).toBeTruthy();
    expect(body.risk?.riskBand).toBe("HIGH");

    await app.close();
  });
});
