import { afterEach, describe, expect, it } from "vitest";

import { shouldExposeNetworkRegisterDevOtp } from "./otp";

describe("shouldExposeNetworkRegisterDevOtp", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSuppress = process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSuppress === undefined) {
      delete process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;
    } else {
      process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP = originalSuppress;
    }
  });

  it("returns false outside development", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;
    expect(shouldExposeNetworkRegisterDevOtp()).toBe(false);
  });

  it("returns true in development by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;
    expect(shouldExposeNetworkRegisterDevOtp()).toBe(true);
  });

  it("returns false in development when suppress flag is enabled", () => {
    process.env.NODE_ENV = "development";
    process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP = "true";
    expect(shouldExposeNetworkRegisterDevOtp()).toBe(false);
  });
});
