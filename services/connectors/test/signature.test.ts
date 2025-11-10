import { createSignature, verifySignature } from "../src/signature.js";

describe("signature helpers", () => {
  it("verifies matching signatures within tolerance", () => {
    const secret = "test-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ hello: "world" });

    const signature = createSignature({ secret }, { payload, timestamp });
    expect(
      verifySignature(
        { secret, toleranceMs: 10_000 },
        { payload, timestamp },
        signature,
      ),
    ).toBe(true);
  });

  it("rejects signatures outside the tolerance window", () => {
    const secret = "test-secret";
    const timestamp = Math.floor(Date.now() / 1000 - 60 * 60).toString();
    const payload = JSON.stringify({ hello: "world" });
    const signature = createSignature({ secret }, { payload, timestamp });

    expect(
      verifySignature(
        { secret, toleranceMs: 1_000 },
        { payload, timestamp },
        signature,
      ),
    ).toBe(false);
  });
});
