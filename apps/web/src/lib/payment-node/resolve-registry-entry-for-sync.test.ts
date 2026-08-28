import { beforeEach, describe, expect, it, vi } from "vitest";

const getPaymentNodeClientForUserMock = vi.fn();
const tryCreateAdminPaymentNodeClientMock = vi.fn();

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("./get-admin-client", () => ({
  tryCreateAdminPaymentNodeClient: tryCreateAdminPaymentNodeClientMock,
}));

const { getRegistryEntryForSync } =
  await import("./resolve-registry-entry-for-sync");

describe("getRegistryEntryForSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user-scoped registry row when visible", async () => {
    const userEntry = {
      id: "registry-1",
      state: "RegistrationConfirmed",
      agentIdentifier: "policy+name",
    };
    const userGetRegistryById = vi.fn().mockResolvedValue(userEntry);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryById: userGetRegistryById,
    });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryById: vi.fn(),
    });

    const entry = await getRegistryEntryForSync({
      userId: "user-1",
      externalId: "registry-1",
      network: "Preprod",
    });

    expect(entry).toStrictEqual(userEntry);
    expect(userGetRegistryById).toHaveBeenCalledWith({
      id: "registry-1",
      network: "Preprod",
    });
    expect(tryCreateAdminPaymentNodeClientMock).not.toHaveBeenCalled();
  });

  it("falls back to admin lookup when the user key cannot see the row", async () => {
    const adminEntry = {
      id: "registry-1",
      state: "RegistrationConfirmed",
      agentIdentifier: "policy+name",
    };
    const userGetRegistryById = vi.fn().mockResolvedValue(null);
    const adminGetRegistryById = vi.fn().mockResolvedValue(adminEntry);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryById: userGetRegistryById,
    });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryById: adminGetRegistryById,
    });

    const entry = await getRegistryEntryForSync({
      userId: "user-1",
      externalId: "registry-1",
      network: "Preprod",
    });

    expect(entry).toStrictEqual(adminEntry);
    expect(userGetRegistryById).toHaveBeenCalled();
    expect(adminGetRegistryById).toHaveBeenCalledWith({
      id: "registry-1",
      network: "Preprod",
    });
  });

  it("returns null when neither user nor admin can resolve the row", async () => {
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryById: vi.fn().mockResolvedValue(null),
    });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryById: vi.fn().mockResolvedValue(null),
    });

    const entry = await getRegistryEntryForSync({
      userId: "user-1",
      externalId: "missing",
      network: "Preprod",
    });

    expect(entry).toBeNull();
  });
});
