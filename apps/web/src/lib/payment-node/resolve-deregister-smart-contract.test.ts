import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractPolicyIdFromAgentIdentifier,
  resolveSmartContractAddressForDeregister,
} from "./resolve-deregister-smart-contract";

const { getSmartContractAddressForConfiguredSourceMock } = vi.hoisted(() => ({
  getSmartContractAddressForConfiguredSourceMock: vi.fn(),
}));

vi.mock("./resolve-smart-contract", () => ({
  getSmartContractAddressForConfiguredSource:
    getSmartContractAddressForConfiguredSourceMock,
}));

const POLICY_ID = "a".repeat(56);
const ASSET_NAME_HEX = "616173736574"; // "asset" in hex
const AGENT_IDENTIFIER = `${POLICY_ID}${ASSET_NAME_HEX}`;

describe("extractPolicyIdFromAgentIdentifier", () => {
  it("returns the first 56 hex chars", () => {
    expect(extractPolicyIdFromAgentIdentifier(AGENT_IDENTIFIER)).toBe(
      POLICY_ID,
    );
  });

  it("returns null for identifiers shorter than 56 chars", () => {
    expect(extractPolicyIdFromAgentIdentifier("short")).toBeNull();
  });
});

describe("resolveSmartContractAddressForDeregister", () => {
  const getPaymentSourcesMock = vi.fn();

  const client = {
    getPaymentSources: getPaymentSourcesMock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "ps-1",
          network: "Preprod",
          policyId: POLICY_ID,
          smartContractAddress: "addr_test1contracta",
        },
        {
          id: "ps-2",
          network: "Preprod",
          policyId: "b".repeat(56),
          smartContractAddress: "addr_test1contractb",
        },
      ],
    });
    getSmartContractAddressForConfiguredSourceMock.mockResolvedValue(
      "addr_test1default",
    );
  });

  it("prefers metadata.smartContractAddress", async () => {
    await expect(
      resolveSmartContractAddressForDeregister(
        client,
        "user-1",
        "Preprod",
        AGENT_IDENTIFIER,
        { smartContractAddress: "addr_test1saved" },
      ),
    ).resolves.toBe("addr_test1saved");
    expect(getPaymentSourcesMock).not.toHaveBeenCalled();
  });

  it("resolves by stored paymentSourceId when metadata address is missing", async () => {
    await expect(
      resolveSmartContractAddressForDeregister(
        client,
        "user-1",
        "Preprod",
        AGENT_IDENTIFIER,
        { paymentSourceId: "ps-2" },
      ),
    ).resolves.toBe("addr_test1contractb");
  });

  it("resolves by policy id from agentIdentifier when metadata is incomplete", async () => {
    await expect(
      resolveSmartContractAddressForDeregister(
        client,
        "user-1",
        "Preprod",
        AGENT_IDENTIFIER,
        {},
      ),
    ).resolves.toBe("addr_test1contracta");
  });

  it("falls back to configured payment source", async () => {
    getPaymentSourcesMock.mockResolvedValue({ PaymentSources: [] });

    await expect(
      resolveSmartContractAddressForDeregister(
        client,
        "user-1",
        "Preprod",
        AGENT_IDENTIFIER,
        {},
      ),
    ).resolves.toBe("addr_test1default");
  });
});
