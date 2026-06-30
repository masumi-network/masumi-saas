import { describe, expect, it } from "vitest";

import { VerificationMethod } from "@/lib/payment-node/verification-schemas";

import {
  buildCredentialAttributesForAgent,
  buildRegistryVerificationAnchors,
  buildRegistryVerificationAnchorsFromCredential,
  credentialAgentIdForRegistry,
} from "./build-registry-verifications";

const POLICY_ID = "a".repeat(56);
const ROOT = "b".repeat(56);
const VERSIONED = POLICY_ID + "10" + ROOT + "000001";
const STABLE = POLICY_ID + ROOT;

describe("buildRegistryVerificationAnchors", () => {
  it("builds a KERI-ACDC verification block", () => {
    const anchors = buildRegistryVerificationAnchors({
      issuerAid: "EISSUER",
      issuerOobi: "https://issuer.example/oobi/EISSUER",
      schemaSaid: "ESCHEMA",
      schemaOobi: "https://schema.example/oobi/ESCHEMA",
      credentialSaid: "ECRED",
      credentialOobi: "https://cred.example/oobi/ECRED",
      credentialRegistry: "EREG",
      holderAid: "EHOLDER",
      holderOobi: "https://holder.example/oobi/EHOLDER",
      baseUrl: "https://verify.example",
      schemaVersion: "1",
    });

    expect(anchors).toEqual([
      {
        method: VerificationMethod.KeriAcdc,
        schemaVersion: "1",
        issuer: {
          aid: "EISSUER",
          oobi: "https://issuer.example/oobi/EISSUER",
        },
        schema: {
          said: "ESCHEMA",
          oobi: "https://schema.example/oobi/ESCHEMA",
        },
        credential: {
          said: "ECRED",
          oobi: "https://cred.example/oobi/ECRED",
          registry: "EREG",
        },
        holder: {
          aid: "EHOLDER",
          oobi: "https://holder.example/oobi/EHOLDER",
        },
        baseUrl: "https://verify.example",
      },
    ]);
  });
});

describe("credentialAgentIdForRegistry", () => {
  it("uses version-independent agent id in credential attributes", () => {
    expect(credentialAgentIdForRegistry(VERSIONED)).toBe(STABLE);
    expect(
      buildCredentialAttributesForAgent({
        versionedAgentIdentifier: VERSIONED,
        agentName: "Agent",
        agentApiUrl: "https://agent.example",
        kycVerificationId: "kyc-1",
        signature: "sig",
      }).agentId,
    ).toBe(STABLE);
  });
});

describe("buildRegistryVerificationAnchorsFromCredential", () => {
  it("maps credential sad fields to registry anchors", () => {
    const anchors = buildRegistryVerificationAnchorsFromCredential({
      credential: {
        sad: {
          d: "ECRED",
          i: "EISSUER",
          ri: "EREG",
          s: "ESCHEMA",
          a: { i: "EHOLDER" },
        },
      },
      issuerOobi: "https://issuer.example/oobi/EISSUER",
      schemaOobi: "https://schema.example/oobi/ESCHEMA",
      credentialOobi: "https://cred.example/oobi/ECRED",
      holderOobi: "https://holder.example/oobi/EHOLDER",
    });

    expect(anchors[0]?.credential.registry).toBe("EREG");
    expect(anchors[0]?.holder.aid).toBe("EHOLDER");
  });
});
