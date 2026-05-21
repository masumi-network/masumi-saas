import { describe, expect, it } from "vitest";

import {
  isThemeType,
  resolveAppliedTheme,
  resolveThemePreference,
} from "@/lib/theme";

describe("theme", () => {
  it("accepts system, light, and dark", () => {
    expect(isThemeType("system")).toBe(true);
    expect(isThemeType("light")).toBe(true);
    expect(isThemeType("dark")).toBe(true);
    expect(isThemeType("sepia")).toBe(false);
  });

  it("defaults missing or invalid storage to system", () => {
    expect(resolveThemePreference(null)).toBe("system");
    expect(resolveThemePreference("")).toBe("system");
    expect(resolveThemePreference("invalid")).toBe("system");
    expect(resolveThemePreference("dark")).toBe("dark");
  });

  it("resolves explicit light and dark preferences", () => {
    expect(resolveAppliedTheme("light")).toBe("light");
    expect(resolveAppliedTheme("dark")).toBe("dark");
  });
});
