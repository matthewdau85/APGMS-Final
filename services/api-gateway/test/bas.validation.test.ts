import fastify from "fastify";

import { registerAuth } from "../src/plugins/auth.js";
import { registerBasRoutes } from "../src/routes/bas.js";
import { injectWithAuth, makeTestPrincipal } from "./helpers/auth.js";

const recordBasLodgmentMock = jest.fn();
const finalizeBasLodgmentMock = jest.fn();
const createTransferInstructionMock = jest.fn();
const createPaymentPlanRequestMock = jest.fn();
const verifyObligationsMock = jest.fn();
const recordCriticalAuditLogMock = jest.fn();

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

jest.mock("../src/lib/audit.js", () => ({
  recordCriticalAuditLog: (...args: any[]) => recordCriticalAuditLogMock(...args),
}));

function debugResponse(res: any) {
  if (!process.env.DEBUG_TESTS) return;
  console.log("STATUS", res.statusCode);
  console.log("RAW", res.body);
  console.log("JSON", res.json());
}

function decodeTestPrincipal(token: string) {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function hasUnrecognizedKeyMessage(body: any) {
  const details = body?.error?.details;
  if (!Array.isArray(details)) return false;
  return details.some((detail: any) =>
    String(detail?.message || "").includes("Unrecognized key")
  );
}

function num(n: number) {
  return {
    toString: () => String(n),
    gt: (m: number) => n > m,
  };
}

const successPrincipal = makeTestPrincipal({
  orgId: "org_test",
  role: "admin",
});

describe("BAS lodgment validation", () => {
  let app: any;

  beforeAll(async () => {
    process.env.AUTH_DEV_SECRET = process.env.AUTH_DEV_SECRET || "test-secret";
    process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "apgms";
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || "apgms-dev";

    app = fastify({ logger: false });
    await app.register(registerAuth);
    app.addHook("preHandler", async (req) => {
      const header = String((req.headers as any).authorization ?? "");
      if (!header.startsWith("Bearer ")) return;
      const payload = decodeTestPrincipal(header.slice("Bearer ".length));
      if (payload) {
        (req as any).user = payload;
      }
    });
    await registerBasRoutes(app);
    await app.ready();
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
    recordCriticalAuditLogMock.mockReset();

    recordBasLodgmentMock.mockResolvedValue({ id: "lodg_test_1" });
    finalizeBasLodgmentMock.mockResolvedValue(undefined);
    createTransferInstructionMock.mockResolvedValue(undefined);
    createPaymentPlanRequestMock.mockResolvedValue(undefined);

    // Success path: no shortfall
    verifyObligationsMock.mockResolvedValue({
      balance: num(0),
      pending: num(0),
      shortfall: null,
    });
    recordCriticalAuditLogMock.mockResolvedValue(undefined);
  });

  it("rejects unknown query keys", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/bas/lodgment?basCycleId=manual&unexpected=1`,
      payload: {
        initiatedBy: "test",
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
      url: `/bas/lodgment?basCycleId=manual`,
      payload: {
        initiatedBy: "test",
        unexpected: 1,
      },
    });

    debugResponse(res);

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(hasUnrecognizedKeyMessage(body)).toBe(true);
  });

  it("allows valid requests", async () => {
    const res = await app.inject(
      injectWithAuth(
        {
          method: "POST",
          url: `/bas/lodgment?basCycleId=manual`,
          payload: { initiatedBy: "test" },
        },
        successPrincipal,
      ),
    );

    debugResponse(res);

    expect(res.statusCode).toBe(200);

    expect(recordBasLodgmentMock).toHaveBeenCalled();
    expect(verifyObligationsMock).toHaveBeenCalled();
    expect(finalizeBasLodgmentMock).toHaveBeenCalled();
  });
});
