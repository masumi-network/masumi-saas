import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const findManyMock = vi.fn();

class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

vi.mock("@masumi/database/client", () => ({
  default: {
    member: {
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {},
  },
}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  UnauthorizedError,
}));

describe("getOrganizationsAction", () => {
  let getOrganizationsAction: typeof import("./organization.action").getOrganizationsAction;

  beforeAll(async () => {
    ({ getOrganizationsAction } = await import("./organization.action"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Unauthorized without logging when auth is missing", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    getAuthenticatedOrThrowMock.mockRejectedValue(new UnauthorizedError());

    await expect(getOrganizationsAction()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(findManyMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("logs unexpected failures and returns a generic message", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const unexpectedError = new Error("boom");

    getAuthenticatedOrThrowMock.mockRejectedValue(unexpectedError);

    await expect(getOrganizationsAction()).resolves.toEqual({
      success: false,
      error: "Failed to load organizations",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to get organizations:",
      unexpectedError,
    );
  });
});
