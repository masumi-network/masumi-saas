import { describe, expect, it, vi } from "vitest";

import { assertSafeRpcUrl, assertSafeRpcUrlResolved } from "./internal.js";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

// vitest hoists vi.mock above the imports above at runtime.
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));
vi.mock("@masumi/database/client", () => ({ default: {} }));

describe("assertSafeRpcUrl", () => {
  it("accepts public https RPC endpoints", () => {
    expect(() =>
      assertSafeRpcUrl("https://mainnet.example.org/rpc"),
    ).not.toThrow();
  });

  it("rejects loopback, private and link-local literals", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://169.254.169.254/",
      "http://[::1]/",
      "http://localhost/",
    ]) {
      expect(() => assertSafeRpcUrl(url), url).toThrow();
    }
  });

  it("rejects non-standard numeric encodings that resolve to internal IPs", () => {
    for (const url of [
      "http://2130706433/", // decimal for 127.0.0.1
      "http://0x7f000001/", // hex for 127.0.0.1
      "http://127.1/", // short-form dotted 127.0.0.1
      "http://192.168.1/", // short-form dotted
    ]) {
      expect(() => assertSafeRpcUrl(url), url).toThrow();
    }
  });

  it("rejects non-http(s) protocols", () => {
    expect(() => assertSafeRpcUrl("file:///etc/passwd")).toThrow();
    expect(() => assertSafeRpcUrl("ftp://example.org/")).toThrow();
  });
});

describe("assertSafeRpcUrlResolved", () => {
  it("rejects a public hostname that resolves to an internal address", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      assertSafeRpcUrlResolved("https://rebind.example.com/rpc"),
    ).rejects.toThrow(/private, loopback or link-local/);
  });

  it("accepts a hostname that resolves to a public address", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(
      assertSafeRpcUrlResolved("https://public.example.com/rpc"),
    ).resolves.toBeUndefined();
  });

  it("does not re-resolve IP literals", async () => {
    lookupMock.mockReset();
    await expect(
      assertSafeRpcUrlResolved("https://93.184.216.34/rpc"),
    ).resolves.toBeUndefined();
    expect(lookupMock).not.toHaveBeenCalled();
  });
});
