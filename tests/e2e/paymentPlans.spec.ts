import { test, expect, type APIRequestContext } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001";

const demoOrg = "demo-org";

async function createPlan(request: APIRequestContext) {
  const response = await request.post(`${API_BASE}/payment-plans`, {
    data: {
      orgId: demoOrg,
      basCycleId: "cycle-1",
      reason: "Shortfall remediation",
      weeklyAmount: 1200,
      startDate: new Date().toISOString().slice(0, 10),
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.plan.id as string;
}

test.describe("payment plan API", () => {
  test("records plan lifecycle", async ({ request }) => {
    test.skip(!process.env.RUN_E2E_API, "API not available in this environment");
    const id = await createPlan(request);
    const listResponse = await request.get(`${API_BASE}/payment-plans`, { params: { orgId: demoOrg } });
    expect(listResponse.ok()).toBeTruthy();
    const list = await listResponse.json();
    expect(Array.isArray(list.plans)).toBe(true);
    expect(list.plans.some((plan: any) => plan.id === id)).toBe(true);

    const statusResponse = await request.post(`${API_BASE}/payment-plans/${id}/status`, {
      data: { status: "APPROVED" },
    });
    expect(statusResponse.ok()).toBeTruthy();
    const updated = await statusResponse.json();
    expect(updated.plan.status).toBe("APPROVED");
  });
});
