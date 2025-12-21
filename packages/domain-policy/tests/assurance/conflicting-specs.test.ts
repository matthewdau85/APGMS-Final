test("fails when multiple active specs conflict", () => {
  expect(() => {
    // simulate resolver returning two active specs
    throw new Error("Multiple active tax specs detected");
  }).toThrow(/conflict/i);
});
