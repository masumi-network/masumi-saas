import { describe, expect, it } from "vitest";

import {
  deriveVerificationPresentation,
  isMasumiNetworkVerified,
} from "./verification-display";

describe("deriveVerificationPresentation", () => {
  it("returns verifiedOnChain when resolution is on-chain", () => {
    expect(
      deriveVerificationPresentation({
        dbStatus: "VERIFIED",
        onChain: {
          verified: true,
          resolutionSource: "on-chain",
          registryState: "RegistrationConfirmed",
          hasAnchors: true,
        },
      }),
    ).toBe("verifiedOnChain");
  });

  it("returns updateInProgress when registry update is pending", () => {
    expect(
      deriveVerificationPresentation({
        dbStatus: "VERIFIED",
        onChain: {
          verified: false,
          resolutionSource: null,
          registryState: "UpdateRequested",
          hasAnchors: false,
        },
      }),
    ).toBe("updateInProgress");
  });

  it("returns updateInProgress even when on-chain read still looks verified", () => {
    expect(
      deriveVerificationPresentation({
        dbStatus: "VERIFIED",
        onChain: {
          verified: true,
          resolutionSource: "on-chain",
          registryState: "UpdateInitiated",
          hasAnchors: true,
        },
      }),
    ).toBe("updateInProgress");
  });

  it("returns updateInProgress when SaaS registration state is update pending", () => {
    expect(
      deriveVerificationPresentation({
        dbStatus: "VERIFIED",
        onChain: null,
        registrationState: "UpdateRequested",
      }),
    ).toBe("updateInProgress");
  });

  it("returns onChainPending when DB is verified but chain is not", () => {
    expect(
      deriveVerificationPresentation({
        dbStatus: "VERIFIED",
        onChain: {
          verified: false,
          resolutionSource: "database",
          registryState: "RegistrationConfirmed",
          hasAnchors: false,
        },
      }),
    ).toBe("onChainPending");
  });

  it("returns pending for unverified agents", () => {
    expect(
      deriveVerificationPresentation({
        dbStatus: "PENDING",
        onChain: null,
      }),
    ).toBe("pending");
  });
});

describe("isMasumiNetworkVerified", () => {
  it("is true only for verifiedOnChain", () => {
    expect(isMasumiNetworkVerified("verifiedOnChain")).toBe(true);
    expect(isMasumiNetworkVerified("onChainPending")).toBe(false);
    expect(isMasumiNetworkVerified("updateInProgress")).toBe(false);
  });
});
