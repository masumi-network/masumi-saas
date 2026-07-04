import { describe, expect, it } from "vitest";

import {
  getRegistrationStatusDisplayKey,
  getRegistrationStatusKey,
} from "./agent-utils";

describe("registration status display", () => {
  it("maps registry update lifecycle to pending", () => {
    expect(getRegistrationStatusKey("UpdateRequested")).toBe("pending");
    expect(getRegistrationStatusKey("UpdateInitiated")).toBe("pending");
    expect(getRegistrationStatusDisplayKey("UpdateRequested")).toBe("pending");
    expect(getRegistrationStatusDisplayKey("UpdateInitiated")).toBe("pending");
  });

  it("maps settled registration to registered", () => {
    expect(getRegistrationStatusDisplayKey("RegistrationConfirmed")).toBe(
      "registered",
    );
  });
});
