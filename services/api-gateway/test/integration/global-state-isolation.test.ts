import { setServiceMode, getServiceMode, _resetServiceModeForTests } from "../../src/service-mode";

afterEach(() => {
  _resetServiceModeForTests();
});

test("service mode resets between tests (sentinel)", async () => {
  setServiceMode("read-only");
  expect(getServiceMode().mode).toBe("read-only");
});

test("next test sees normal mode", async () => {
  expect(getServiceMode().mode).toBe("normal");
});
