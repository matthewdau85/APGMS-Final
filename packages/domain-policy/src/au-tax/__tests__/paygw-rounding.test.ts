// packages/domain-policy/src/au-tax/__tests__/paygw-rounding.test.ts

import { computeWithholding } from "../paygw-rounding.js";

describe("computeWithholding rounding", () => {
  it("returns stable weekly/fortnightly/monthly cents", () => {
    expect(
      computeWithholding({
        annualAmountCents: 5200,
        payPeriod: "WEEKLY",
      }),
    ).toBe(100);

    expect(
      computeWithholding({
        annualAmountCents: 5200,
        payPeriod: "FORTNIGHTLY",
      }),
    ).toBe(200);

    expect(
      computeWithholding({
        annualAmountCents: 5200,
        payPeriod: "MONTHLY",
      }),
    ).toBe(433);
  });

  it("applies half-even (bankers) rounding by default", () => {
    // 26/52 = 0.5 -> rounds to 0 (even)
    expect(
      computeWithholding({
        annualAmountCents: 26,
        payPeriod: "WEEKLY",
      }),
    ).toBe(0);

    // 78/52 = 1.5 -> rounds to 2 (since 1 is odd)
    expect(
      computeWithholding({
        annualAmountCents: 78,
        payPeriod: "WEEKLY",
      }),
    ).toBe(2);
  });

  it("supports half-up rounding", () => {
    expect(
      computeWithholding({
        annualAmountCents: 26,
        payPeriod: "WEEKLY",
        policy: { precision: 2, method: "round_half_up" },
      }),
    ).toBe(1);
  });

  it("can round to whole dollars (returned as cents) when precision=0", () => {
    // Annual 7800 cents => weekly 150 cents => 1.50 dollars => rounds to 2 dollars => 200 cents
    expect(
      computeWithholding({
        annualAmountCents: 7800,
        payPeriod: "WEEKLY",
        policy: { precision: 0, method: "round_half_up" },
      }),
    ).toBe(200);
  });
});
