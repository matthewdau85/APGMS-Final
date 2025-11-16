import { AtoBasClient, AtoStpClient } from "../src/index.js";

describe("ATO provider clients", () => {
  const credential = {
    keystorePath: "/tmp/keystore.p12",
    keystorePassword: "secret",
    keystoreAlias: "apgms",
    softwareId: "A0000000000001",
  };

  const fetchMock = () => {
    const fn = jest.fn();
    fn.mockResolvedValue({
      ok: true,
      json: async () => ({ submissionId: "123", statusEndpoint: "/status/123" }),
      text: async () => "",
    });
    return fn;
  };

  it("submits STP pay events with software identifiers", async () => {
    const mock = fetchMock();
    const client = new AtoStpClient(credential, { baseUrl: "https://example.ato.gov.au", fetch: mock });

    await client.submitSingleTouchPayroll({ specification: "ATO-STP-PHASE-2", version: "2.0.0", payload: { foo: "bar" } });

    expect(mock).toHaveBeenCalledWith(new URL("/stp/v2/payevents", "https://example.ato.gov.au"), expect.objectContaining({
      method: "POST",
    }));
    const [, init] = mock.mock.calls[0];
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("submits BAS statements via the lodgement endpoint", async () => {
    const mock = fetchMock();
    const client = new AtoBasClient(credential, { baseUrl: "https://example.ato.gov.au", fetch: mock });

    await client.submitBas({
      documentId: "BAS-001",
      lodgementPeriod: "2024-10",
      gstOnSales: 15000,
      gstOnPurchases: 9000,
      paygWithholding: 1870,
      paygInstalment: 1200,
    });

    expect(mock).toHaveBeenCalledWith(new URL("/bas/v2/lodgements", "https://example.ato.gov.au"), expect.objectContaining({
      method: "POST",
    }));
  });
});
