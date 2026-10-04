import { describe, expect, it } from "vitest";

import {
  getRegistrationStatusDisplayKey,
  getRegistrationStatusKey,
} from "./agent-utils";

describe("registration status display", () => {
  it("maps in-flight registration to registering", () => {
    expect(getRegistrationStatusDisplayKey("RegistrationRequested")).toBe(
      "registering",
    );
    expect(getRegistrationStatusDisplayKey("RegistrationInitiated")).toBe(
      "registering",
    );
  });

  it("maps registry update lifecycle to update-specific labels", () => {
    expect(getRegistrationStatusKey("UpdateRequested")).toBe("updateRequested");
    expect(getRegistrationStatusKey("UpdateInitiated")).toBe("updateInitiated");
    expect(getRegistrationStatusDisplayKey("UpdateRequested")).toBe(
      "updateRequested",
    );
    expect(getRegistrationStatusDisplayKey("UpdateInitiated")).toBe(
      "updateInitiated",
    );
  });

  it("maps settled registration to registered", () => {
    expect(getRegistrationStatusDisplayKey("RegistrationConfirmed")).toBe(
      "registered",
    );
  });
});
