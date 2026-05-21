import { describe, expect, it } from "vitest";

import {
  hashCanonicalJsonValue,
  hashInputData,
  hashInputSchema,
  hashResult,
} from "./hash";
import { getDefaultLangdockInputSchema } from "./input-schema";

describe("MIP hash helpers", () => {
  it("hashes canonical JSON with stable object-key ordering", () => {
    expect(
      hashInputData(
        { z: 2, a: "one", nested: { b: true, a: [3, 1] } },
        "buyer-1",
      ),
    ).toBe("e7fa910005c820eb29fdc711ccf14fc6937a0b407ecaf28beb017af394fa6d94");
  });

  it("hashes escaped result text using the purchaser identifier prefix", () => {
    expect(hashResult('first line\nsecond "quoted"', "buyer-1")).toBe(
      "dd81ff5cb83cbb9ee01300b82eefcaf419f1a2479ff0105e5f31a83959f899a0",
    );
  });

  it("hashes normalized input schemas and rejects invalid schemas", () => {
    expect(hashInputSchema(getDefaultLangdockInputSchema())).toBe(
      "9492d69927cc44ccf6844f55b41aa510b1fa2bd01901965f5362e5a6a1e994fe",
    );
    expect(
      hashInputSchema({
        input_data: [
          { id: "duplicate", type: "textarea", name: "A" },
          { id: "duplicate", type: "textarea", name: "B" },
        ],
      }),
    ).toBeNull();
  });

  it("returns null when canonical serialization cannot produce JSON", () => {
    expect(hashCanonicalJsonValue(undefined)).toBeNull();
  });
});
