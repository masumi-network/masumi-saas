import { describe, expect, it } from "vitest";

import {
  canDeregisterAgent,
  canRequestAgentVerification,
  isAgentLiveOnRegistry,
  isRegistrationSyncPending,
  isRegistrationUiPending,
  registrationStateFromRegistryEntry,
  resolveRegistrationStateAfterSync,
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

describe("resolveRegistrationStateAfterSync", () => {
  it("keeps optimistic UpdateRequested when node is still RegistrationConfirmed", () => {
    expect(
      resolveRegistrationStateAfterSync({
        previousState: "UpdateRequested",
        registryState: "RegistrationConfirmed",
      }),
    ).toBe("UpdateRequested");
  });

  it("keeps optimistic UpdateInitiated when node is still RegistrationConfirmed", () => {
    expect(
      resolveRegistrationStateAfterSync({
        previousState: "UpdateInitiated",
        registryState: "RegistrationConfirmed",
      }),
    ).toBe("UpdateInitiated");
  });

  it("advances to RegistrationConfirmed when node reports UpdateConfirmed", () => {
    expect(
      resolveRegistrationStateAfterSync({
        previousState: "UpdateRequested",
        registryState: "UpdateConfirmed",
      }),
    ).toBe("RegistrationConfirmed");
  });

  it("syncs forward when SaaS is RegistrationConfirmed and node is UpdateRequested", () => {
    expect(
      resolveRegistrationStateAfterSync({
        previousState: "RegistrationConfirmed",
        registryState: "UpdateRequested",
      }),
    ).toBe("UpdateRequested");
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

describe("canRequestAgentVerification", () => {
  it("allows registered and failed-update agents", () => {
    expect(canRequestAgentVerification("RegistrationConfirmed")).toBe(true);
    expect(canRequestAgentVerification("UpdateFailed")).toBe(true);
  });

  it("blocks pending registration and in-flight updates", () => {
    expect(canRequestAgentVerification("RegistrationRequested")).toBe(false);
    expect(canRequestAgentVerification("UpdateRequested")).toBe(false);
    expect(canRequestAgentVerification("UpdateInitiated")).toBe(false);
  });
});

describe("isAgentLiveOnRegistry", () => {
  it("includes update lifecycle states", () => {
    expect(isAgentLiveOnRegistry("RegistrationConfirmed")).toBe(true);
    expect(isAgentLiveOnRegistry("UpdateRequested")).toBe(true);
    expect(isAgentLiveOnRegistry("RegistrationRequested")).toBe(false);
  });
});

describe("canDeregisterAgent", () => {
  it("allows only settled registration states", () => {
    expect(canDeregisterAgent("RegistrationConfirmed")).toBe(true);
    expect(canDeregisterAgent("DeregistrationFailed")).toBe(true);
  });

  it("blocks in-flight registration and registry updates", () => {
    expect(canDeregisterAgent("RegistrationRequested")).toBe(false);
    expect(canDeregisterAgent("UpdateRequested")).toBe(false);
    expect(canDeregisterAgent("UpdateInitiated")).toBe(false);
    expect(canDeregisterAgent("DeregistrationRequested")).toBe(false);
  });
});
