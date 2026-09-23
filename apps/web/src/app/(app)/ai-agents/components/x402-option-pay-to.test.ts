import { describe, expect, it } from "vitest";

import { resolvePayToOnChainChange } from "./x402-option-pay-to";

const FACILITATOR_A = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const FACILITATOR_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("resolvePayToOnChainChange", () => {
  it("fills payTo when empty and facilitator exists", () => {
    expect(
      resolvePayToOnChainChange({
        currentPayTo: "",
        previousFacilitatorAddress: null,
        nextFacilitatorAddress: FACILITATOR_A,
      }),
    ).toBe(FACILITATOR_A);
  });

  it("updates payTo when it matched the previous facilitator", () => {
    expect(
      resolvePayToOnChainChange({
        currentPayTo: FACILITATOR_A,
        previousFacilitatorAddress: FACILITATOR_A,
        nextFacilitatorAddress: FACILITATOR_B,
      }),
    ).toBe(FACILITATOR_B);
  });

  it("does not overwrite a custom payTo address", () => {
    expect(
      resolvePayToOnChainChange({
        currentPayTo: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        previousFacilitatorAddress: FACILITATOR_A,
        nextFacilitatorAddress: FACILITATOR_B,
      }),
    ).toBeUndefined();
  });

  it("returns undefined when the next chain has no facilitator", () => {
    expect(
      resolvePayToOnChainChange({
        currentPayTo: "",
        previousFacilitatorAddress: FACILITATOR_A,
        nextFacilitatorAddress: null,
      }),
    ).toBeUndefined();
  });
});
