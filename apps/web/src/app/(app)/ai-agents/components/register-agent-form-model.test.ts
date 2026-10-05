import { describe, expect, it } from "vitest";

import {
  buildRegisterAgentDefaultValues,
  buildRegisterAgentResetValues,
  buildRegisterAgentSchema,
  buildX402ResourceProbeKey,
  isProbeableResourceUrl,
  type RegisterAgentFormType,
  registerFormHasMeaningfulDraft,
} from "./register-agent-form-model";

const translate = (key: string) => key;

function values(
  overrides: Partial<RegisterAgentFormType> = {},
): RegisterAgentFormType {
  return {
    ...buildRegisterAgentDefaultValues("STANDARD", "lovelace"),
    ...overrides,
  };
}

function issuePaths(input: RegisterAgentFormType) {
  const result = buildRegisterAgentSchema(translate, "Preprod").safeParse(
    input,
  );
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
}

describe("buildX402ResourceProbeKey", () => {
  it("joins the network and the trimmed URL", () => {
    expect(buildX402ResourceProbeKey("Preprod", "  https://a.example/x ")).toBe(
      "Preprod|https://a.example/x",
    );
  });
});

describe("isProbeableResourceUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isProbeableResourceUrl("https://a.example/x")).toBe(true);
    expect(isProbeableResourceUrl(" http://a.example ")).toBe(true);
  });

  it("rejects other protocols and invalid input", () => {
    expect(isProbeableResourceUrl("ftp://a.example")).toBe(false);
    expect(isProbeableResourceUrl("not a url")).toBe(false);
    expect(isProbeableResourceUrl("")).toBe(false);
  });
});

describe("registerFormHasMeaningfulDraft", () => {
  it("is false for untouched standard defaults", () => {
    expect(registerFormHasMeaningfulDraft(values(), [], "", [])).toBe(false);
  });

  it("treats Free as the baseline pricing for x402 registrations", () => {
    expect(
      registerFormHasMeaningfulDraft(
        values({ registrationKind: "X402_HTTP", pricingType: "Free" }),
        [],
        "",
        [],
      ),
    ).toBe(false);
    expect(
      registerFormHasMeaningfulDraft(
        values({ pricingType: "Free" }),
        [],
        "",
        [],
      ),
    ).toBe(true);
  });

  it("detects tags, pending tag input and typed fields", () => {
    expect(registerFormHasMeaningfulDraft(values(), ["a"], "", [])).toBe(true);
    expect(registerFormHasMeaningfulDraft(values(), [], " b ", [])).toBe(true);
    expect(
      registerFormHasMeaningfulDraft(values({ name: "Agent" }), [], "", []),
    ).toBe(true);
    expect(
      registerFormHasMeaningfulDraft(values({ icon: "robot" }), [], "", []),
    ).toBe(true);
  });

  it("only counts the URL field of the selected registration kind", () => {
    expect(
      registerFormHasMeaningfulDraft(
        values({ x402ResourceUrl: "https://a.example" }),
        [],
        "",
        [],
      ),
    ).toBe(false);
    expect(
      registerFormHasMeaningfulDraft(
        values({ apiUrl: "https://a.example" }),
        [],
        "",
        [],
      ),
    ).toBe(true);
  });

  it("counts new Langdock credentials but not a saved connection", () => {
    expect(
      registerFormHasMeaningfulDraft(
        values({ runtimeProvider: "LANGDOCK", langdockAgentId: "agent" }),
        [],
        "",
        [],
      ),
    ).toBe(true);
    expect(
      registerFormHasMeaningfulDraft(
        values({
          runtimeProvider: "LANGDOCK",
          integrationConnectionId: "saved",
          langdockAgentId: "agent",
        }),
        [],
        "",
        [],
      ),
    ).toBe(false);
  });
});

describe("register form values", () => {
  it("resets without a payout address and defaults it to empty", () => {
    expect(
      buildRegisterAgentResetValues("X402_HTTP", "lovelace"),
    ).not.toHaveProperty("payoutAddress");
    const defaults = buildRegisterAgentDefaultValues("X402_HTTP", "lovelace");
    expect(defaults.payoutAddress).toBe("");
    expect(defaults.registrationKind).toBe("X402_HTTP");
    expect(defaults.prices).toEqual([{ amount: "", asset: "lovelace" }]);
  });
});

describe("buildRegisterAgentSchema", () => {
  it("requires a resource URL for x402 registrations", () => {
    expect(
      issuePaths(values({ registrationKind: "X402_HTTP", name: "Agent" })),
    ).toEqual([
      { path: "x402ResourceUrl", message: "x402ResourceUrlRequired" },
    ]);
  });

  it("blocks several resource URLs in the single-agent form", () => {
    expect(
      issuePaths(
        values({
          registrationKind: "X402_HTTP",
          name: "Agent",
          x402ResourceUrl: "https://a.example/one\nhttps://a.example/two",
        }),
      ),
    ).toEqual([
      { path: "x402ResourceUrl", message: "x402MultipleResourcesBlocked" },
    ]);
  });

  it("validates the API URL and payout address of fixed standard pricing", () => {
    expect(
      issuePaths(
        values({
          name: "Agent",
          apiUrl: "ftp://a.example",
          prices: [{ amount: "1", asset: "lovelace" }],
        }),
      ),
    ).toEqual([
      { path: "apiUrl", message: "apiUrlProtocol" },
      { path: "payoutAddress", message: "payoutAddressRequired" },
    ]);
  });

  it("requires a fixed price amount for standard registrations", () => {
    expect(
      issuePaths(
        values({
          name: "Agent",
          apiUrl: "https://a.example",
          pricingType: "Fixed",
        }),
      ).map((issue) => issue.path),
    ).toContain("prices");
  });

  it("accepts a free standard registration with a valid API URL", () => {
    expect(
      issuePaths(
        values({
          name: "Agent",
          apiUrl: "https://a.example",
          pricingType: "Free",
        }),
      ),
    ).toEqual([]);
  });
});
