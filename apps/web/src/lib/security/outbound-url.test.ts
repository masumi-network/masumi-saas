import { afterEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

type EnvSnapshot = Record<string, string | undefined>;

function setEnvValue(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
    return;
  }

  env[key] = value;
}

function captureEnv(): EnvSnapshot {
  return {
    NODE_ENV: process.env.NODE_ENV,
  };
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    setEnvValue(key, value);
  }
}

describe("assertAllowedAgentApiUrl", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    lookupMock.mockReset();
    vi.resetModules();
  });

  it("allows local HTTP agent URLs outside production", async () => {
    setEnvValue("NODE_ENV", "test");
    const { assertAllowedAgentApiUrl } = await import("./outbound-url");

    await expect(
      assertAllowedAgentApiUrl("http://127.0.0.1:8787/agent"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects non-HTTPS URLs in production", async () => {
    setEnvValue("NODE_ENV", "production");
    const { assertAllowedAgentApiUrl, OutboundUrlValidationError } =
      await import("./outbound-url");

    await expect(
      assertAllowedAgentApiUrl("http://agent.example.com"),
    ).rejects.toBeInstanceOf(OutboundUrlValidationError);
  });

  it("rejects private IPv4 targets in production", async () => {
    setEnvValue("NODE_ENV", "production");
    const { assertAllowedAgentApiUrl } = await import("./outbound-url");

    await expect(
      assertAllowedAgentApiUrl("https://127.0.0.1:8787/agent"),
    ).rejects.toThrow("public internet host");
  });

  it("rejects hostnames that resolve to private network addresses in production", async () => {
    setEnvValue("NODE_ENV", "production");
    lookupMock.mockResolvedValue([{ address: "192.168.1.8", family: 4 }]);
    const { assertAllowedAgentApiUrl } = await import("./outbound-url");

    await expect(
      assertAllowedAgentApiUrl("https://agent.internal.example"),
    ).rejects.toThrow("public internet host");
  });

  it("allows public HTTPS hosts in production", async () => {
    setEnvValue("NODE_ENV", "production");
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const { assertAllowedAgentApiUrl } = await import("./outbound-url");

    await expect(
      assertAllowedAgentApiUrl("https://agent.example.com/mip"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects embedded credentials in any environment", async () => {
    setEnvValue("NODE_ENV", "test");
    const { assertAllowedAgentApiUrl } = await import("./outbound-url");

    await expect(
      assertAllowedAgentApiUrl("https://user:pass@agent.example.com"),
    ).rejects.toThrow("embedded credentials");
  });
});
