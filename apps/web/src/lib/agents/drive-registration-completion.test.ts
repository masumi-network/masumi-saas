import { beforeEach, describe, expect, it, vi } from "vitest";

const completeOnChainRegistrationMock = vi.fn();

vi.mock("@/lib/agent-registration", () => ({
  completeOnChainRegistration: completeOnChainRegistrationMock,
}));

vi.mock("@/lib/debug/do-runtime-log", () => ({
  doRuntimeDebugLog: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  serverLog: { error: vi.fn() },
}));

const {
  MAX_BACKGROUND_COMPLETION_POLLERS,
  scheduleAgentRegistrationCompletion,
} = await import("./drive-registration-completion");

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("scheduleAgentRegistrationCompletion", () => {
  beforeEach(() => {
    completeOnChainRegistrationMock.mockReset();
  });

  it("runs one poller per agent even when scheduled twice", async () => {
    completeOnChainRegistrationMock.mockResolvedValue({ status: "registered" });

    scheduleAgentRegistrationCompletion("agent-dup", "user-1");
    scheduleAgentRegistrationCompletion("agent-dup", "user-1");
    await flush();

    expect(completeOnChainRegistrationMock).toHaveBeenCalledTimes(1);
  });

  it("caps concurrent pollers and drains the queue as they finish", async () => {
    const releases: Array<() => void> = [];
    completeOnChainRegistrationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve({ status: "registered" }));
        }),
    );

    const total = MAX_BACKGROUND_COMPLETION_POLLERS + 3;
    for (let i = 0; i < total; i += 1) {
      scheduleAgentRegistrationCompletion(`agent-cap-${i}`, "user-1");
    }
    await flush();
    expect(completeOnChainRegistrationMock).toHaveBeenCalledTimes(
      MAX_BACKGROUND_COMPLETION_POLLERS,
    );

    releases.splice(0, 3).forEach((release) => release());
    await flush();
    expect(completeOnChainRegistrationMock).toHaveBeenCalledTimes(total);

    releases.forEach((release) => release());
    await flush();
  });
});
