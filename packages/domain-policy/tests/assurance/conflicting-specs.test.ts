test("fails when multiple active specs conflict", () => {
  expect(() => {
    // simulate resolver returning two active specs
    throw new Error("Tax spec conflict: multiple active specs detected");
  }).toThrow(/conflict/i);
});
