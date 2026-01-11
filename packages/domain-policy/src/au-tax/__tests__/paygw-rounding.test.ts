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

  it("applies round-half-even ties correctly", () => {
    expect(
      computeWithholding({
        annualAmountCents: 26,
        payPeriod: "WEEKLY",
      }),
    ).toBe(0);
    expect(
      computeWithholding({
        annualAmountCents: 78,
        payPeriod: "WEEKLY",
      }),
    ).toBe(2);
  });
});
