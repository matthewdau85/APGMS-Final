import { computeObligations } from "../..";

test("fails explicitly when tax spec is missing", () => {
  expect(() =>
    computeObligations({
      taxSpec: null as any,
      inputs: {},
    })
  ).toThrow(/spec/i);
});
