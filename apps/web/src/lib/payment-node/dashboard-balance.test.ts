import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiKeyStatus: vi.fn(),
  getClient: vi.fn(),
}));
vi.mock("./get-user-client", () => ({
  getPaymentNodeClientForUser: mocks.getClient,
}));

import { resolveUserSellingWalletsBalance } from "./address-balance";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getClient.mockResolvedValue({ getApiKeyStatus: mocks.getApiKeyStatus });
});

describe("dashboard balance availability", () => {
  it("keeps the dashboard available when wallet scope lookup fails", async () => {
    mocks.getApiKeyStatus.mockRejectedValue(
      new Error("Payment node unavailable"),
    );
    await expect(
      resolveUserSellingWalletsBalance("user-1", "Preprod"),
    ).resolves.toBe("0 ADA");
  });

  it("keeps the dashboard available when client lookup fails", async () => {
    mocks.getClient.mockRejectedValue(new Error("Client unavailable"));
    await expect(
      resolveUserSellingWalletsBalance("user-1", "Mainnet"),
    ).resolves.toBe("0 ADA");
  });
});
