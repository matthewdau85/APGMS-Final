import { buildTestApp } from "./helpers/buildTestApp";

const recordBasLodgmentMock = jest.fn();
const finalizeBasLodgmentMock = jest.fn();
const createTransferInstructionMock = jest.fn();
const createPaymentPlanRequestMock = jest.fn();
const verifyObligationsMock = jest.fn();

// IMPORTANT:
// Your BAS route imports these from "@apgms/shared" (per your snippet).
// We mock the functions but keep the schemas real.
jest.mock("@apgms/shared", () => {
  const actual = jest.requireActual("@apgms/shared");
  return {
    ...actual,
    recordBasLodgment: (...args: any[]) => recordBasLodgmentMock(...args),
    finalizeBasLodgment: (...args: any[]) => finalizeBasLodgmentMock(...args),
    createTransferInstruction: (...args: any[]) => createTransferInstructionMock(...args),
    createPaymentPlanRequest: (...args: any[]) => createPaymentPlanRequestMock(...args),
    verifyObligations: (...args: any[]) => verifyObligationsMock(...args),
  };
});

function debugResponse(res: any) {
  console.log("STATUS", res.statusCode);
  console.log("RAW", res.body);
  try {
    console.log("JSON", res.json());
  } catch (e) {
    console.log("JSON parse failed", e);
  }
}

function hasUnrecognizedKeyMessage(body: any) {
  const details = body?.error?.details;
  if (!Array.isArray(details)) return false;
  return details.some((detail: any) =>
    String(detail?.message || "").includes("Unrecognized key")
  );
}

// Repo convention (from your grep): Bearer <base64url(JSON)>
function base64UrlEncodeJson(obj: any): string {
  const json = JSON.stringify(obj);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bearerPrincipal(principal: {
  id: string;
  sub?: string;
  orgId: string;
  role: string;
}) {
  return `Bearer ${base64UrlEncodeJson(principal)}`;
}

describe("BAS lodgment validation", () => {
  const orgId = "org_test";
  let app: any;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app?.close?.();
  });

  beforeEach(() => {
    recordBasLodgmentMock.mockReset();
    finalizeBasLodgmentMock.mockReset();
    createTransferInstructionMock.mockReset();
    createPaymentPlanRequestMock.mockReset();
    verifyObligationsMock.mockReset();

    // Shape-correct defaults for your route.
    recordBasLodgmentMock.mockResolvedValue({ id: "lodg_test_1" });
    verifyObligationsMock.mockResolvedValue({
      balance: { toString: () => "0" },
      pending: { toString: () => "0" },
      shortfall: null,
    });
    finalizeBasLodgmentMock.mockResolvedValue(undefined);
    createTransferInstructionMock.mockResolvedValue(undefined);
    createPaymentPlanRequestMock.mockResolvedValue(undefined);
  });

  it("rejects unknown query keys", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/bas/lodge?orgId=${encodeURIComponent(orgId)}&unexpected=1`,
      payload: {
        periodKey: "2025-Q4",
        basType: "quarterly",
        amounts: {
          gstPayable: 0,
          gstCredit: 0,
          paygwWithheld: 0,
        },
      },
    });

    debugResponse(res);

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(hasUnrecognizedKeyMessage(body)).toBe(true);
  });

  it("rejects unknown body keys", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/bas/lodge?orgId=${encodeURIComponent(orgId)}`,
      payload: {
        periodKey: "2025-Q4",
        basType: "quarterly",
        amounts: {
          gstPayable: 0,
          gstCredit: 0,
          paygwWithheld: 0,
        },
        unexpected: 1,
      },
    });

    debugResponse(res);

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(hasUnrecognizedKeyMessage(body)).toBe(true);
  });

  it("allows valid requests", async () => {
    const token = bearerPrincipal({
      id: "user-test-1",
      sub: "user-test-1",
      orgId,
      // This is the missing piece causing your current 403 forbidden_role Role missing
      role: "admin",
    });

    const res = await app.inject({
      method: "POST",
      url: `/bas/lodge?orgId=${encodeURIComponent(orgId)}`,
      headers: {
        authorization: token,
      },
      payload: {
        periodKey: "2025-Q4",
        basType: "quarterly",
        amounts: {
          gstPayable: 0,
          gstCredit: 0,
          paygwWithheld: 0,
        },
      },
    });

    debugResponse(res);

    expect(res.statusCode).toBe(200);
    expect(recordBasLodgmentMock).toHaveBeenCalled();
    expect(verifyObligationsMock).toHaveBeenCalled();
    expect(finalizeBasLodgmentMock).toHaveBeenCalled();
  });
});
