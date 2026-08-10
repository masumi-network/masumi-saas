import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@masumi/database/client", () => ({
  default: {
    networkRegistrationDraft: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth/session-types", () => ({
  getBetterAuthInnerSession: vi.fn(() => null),
}));

import prisma from "@masumi/database/client";
import { getAuthContext } from "@/lib/auth/utils";
import { resolveNetworkRegisterSession } from "./session";

const findUnique = vi.mocked(prisma.networkRegistrationDraft.findUnique);

describe("resolveNetworkRegisterSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires sign-in when there is no session", async () => {
    findUnique.mockResolvedValue({
      id: "draft-1",
      email: "ada@example.com",
      agentId: null,
      status: "PENDING",
    });
    vi.mocked(getAuthContext).mockResolvedValue({
      isAuthenticated: false,
      session: null,
    } as never);

    const result = await resolveNetworkRegisterSession({
      draftId: "draft-1",
      returnPath: "/network-register/continue?draftId=draft-1",
    });

    expect(result).toEqual({
      kind: "sign_in_required",
      returnPath: "/network-register/continue?draftId=draft-1",
      registrationEmail: "ada@example.com",
    });
  });

  it("detects signed-in email mismatch", async () => {
    findUnique.mockResolvedValue({
      id: "draft-1",
      email: "ada@example.com",
      agentId: "agent-1",
      status: "PROCESSING",
    });
    vi.mocked(getAuthContext).mockResolvedValue({
      isAuthenticated: true,
      session: {
        user: {
          id: "user-b",
          email: "bob@example.com",
          name: "Bob",
        },
      },
    } as never);

    const result = await resolveNetworkRegisterSession({
      draftId: "draft-1",
      returnPath: "/network-register/continue?draftId=draft-1",
    });

    expect(result).toEqual({
      kind: "wrong_account",
      returnPath: "/network-register/continue?draftId=draft-1",
      registrationEmail: "ada@example.com",
      signedInEmail: "bob@example.com",
    });
  });
});
