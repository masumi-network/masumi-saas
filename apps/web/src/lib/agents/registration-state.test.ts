import { describe, expect, it } from "vitest";

import {
  isAgentLiveOnRegistry,
  isRegistrationSyncPending,
  isRegistrationUiPending,
  registrationStateFromRegistryEntry,
} from "./registration-state";

describe("registrationStateFromRegistryEntry", () => {
  it("maps UpdateConfirmed to RegistrationConfirmed", () => {
    expect(registrationStateFromRegistryEntry("UpdateConfirmed")).toBe(
      "RegistrationConfirmed",
    );
  });

  it("passes through UpdateRequested", () => {
    expect(registrationStateFromRegistryEntry("UpdateRequested")).toBe(
      "UpdateRequested",
    );
  });
});

describe("pending helpers", () => {
  it("treats update states as sync and UI pending", () => {
    expect(isRegistrationSyncPending("UpdateRequested")).toBe(true);
    expect(isRegistrationSyncPending("RegistrationConfirmed")).toBe(true);
    expect(isRegistrationUiPending("UpdateInitiated")).toBe(true);
    expect(isRegistrationUiPending("RegistrationConfirmed")).toBe(false);
  });
});

describe("isAgentLiveOnRegistry", () => {
  it("includes update lifecycle states", () => {
    expect(isAgentLiveOnRegistry("RegistrationConfirmed")).toBe(true);
    expect(isAgentLiveOnRegistry("UpdateRequested")).toBe(true);
    expect(isAgentLiveOnRegistry("RegistrationRequested")).toBe(false);
  });
});
