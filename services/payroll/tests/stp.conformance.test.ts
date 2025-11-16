import input from "./fixtures/phase2-basic.input.json";
import expected from "./fixtures/phase2-basic.expected.json";
import { buildStpPayload, validateStpPayload } from "../src/index.js";

describe("ATO STP phase 2 conformance", () => {
  it("matches the official schema and the golden payload", () => {
    const payload = buildStpPayload(input, { generatedAt: expected.metadata.generatedAt });
    expect(payload).toEqual(expected);

    const { valid, errors } = validateStpPayload(payload);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });
});
