import { describe, expect, it } from "vitest";

import {
  classifyAuthorizeRequest,
  NO_AUTHORIZE_POLICY,
  planAuthorizePolicy,
} from "./authorize-policy";

const AUTHORIZE_URL = "http://localhost:3000/api/auth/oauth2/authorize?x=1";

describe("classifyAuthorizeRequest", () => {
  it("treats a top-level browser navigation as interactive", () => {
    expect(
      classifyAuthorizeRequest(
        AUTHORIZE_URL,
        new Headers({ accept: "text/html", "sec-fetch-mode": "navigate" }),
      ),
    ).toBe("interactive");
  });

  it("treats fetch and JSON callers as headless", () => {
    expect(
      classifyAuthorizeRequest(
        AUTHORIZE_URL,
        new Headers({ "sec-fetch-mode": "cors" }),
      ),
    ).toBe("headless");
    expect(
      classifyAuthorizeRequest(
        AUTHORIZE_URL,
        new Headers({ accept: "application/json" }),
      ),
    ).toBe("headless");
    expect(classifyAuthorizeRequest(undefined, undefined)).toBe("headless");
  });

  it("treats authorize re-run inside consent or sign-in as resumed", () => {
    expect(
      classifyAuthorizeRequest(
        "http://localhost:3000/api/auth/oauth2/consent",
        new Headers({ accept: "text/html" }),
      ),
    ).toBe("resumed");
  });
});

describe("planAuthorizePolicy", () => {
  const verifiedWeb = {
    clientKey: "web" as const,
    prompt: new Set<string>(),
    hasSession: true,
    emailVerified: true,
  };

  it("forces the consent page for interactive web requests and keeps new API scopes", () => {
    expect(
      planAuthorizePolicy({ ...verifiedWeb, kind: "interactive" }),
    ).toEqual({
      forceConsentPrompt: true,
      enforceStoredGrants: false,
      emailGate: "none",
      autoConsent: false,
    });
  });

  it("does not force consent when the caller asked for prompt=none", () => {
    const plan = planAuthorizePolicy({
      ...verifiedWeb,
      kind: "interactive",
      prompt: new Set(["none"]),
    });
    expect(plan.forceConsentPrompt).toBe(false);
    expect(plan.enforceStoredGrants).toBe(true);
  });

  it("limits a resumed web run to stored grants without re-prompting", () => {
    expect(planAuthorizePolicy({ ...verifiedWeb, kind: "resumed" })).toEqual({
      forceConsentPrompt: false,
      enforceStoredGrants: true,
      emailGate: "none",
      autoConsent: false,
    });
  });

  it("keeps API scopes for a signed-out CLI request until the user is known", () => {
    const plan = planAuthorizePolicy({
      ...verifiedWeb,
      clientKey: "cli",
      kind: "interactive",
      hasSession: false,
      emailVerified: false,
    });
    expect(plan.enforceStoredGrants).toBe(false);
    expect(plan.emailGate).toBe("none");
  });

  it("auto-consents headless verified web requests", () => {
    const plan = planAuthorizePolicy({ ...verifiedWeb, kind: "headless" });
    expect(plan.autoConsent).toBe(true);
    expect(plan.enforceStoredGrants).toBe(true);
  });

  it("leaves the email gate to the consent page when it will show", () => {
    const plan = planAuthorizePolicy({
      ...verifiedWeb,
      emailVerified: false,
      kind: "interactive",
    });
    expect(plan.emailGate).toBe("none");
  });

  it("gates unverified users when no consent page will show", () => {
    const unverifiedCli = {
      ...verifiedWeb,
      clientKey: "cli" as const,
      emailVerified: false,
    };
    expect(
      planAuthorizePolicy({ ...unverifiedCli, kind: "interactive" }).emailGate,
    ).toBe("redirect");
    expect(
      planAuthorizePolicy({ ...unverifiedCli, kind: "resumed" }).emailGate,
    ).toBe("json-redirect");
    expect(
      planAuthorizePolicy({ ...unverifiedCli, kind: "headless" }).emailGate,
    ).toBe("forbidden");
  });

  it("does not gate before sign-in", () => {
    expect(
      planAuthorizePolicy({
        ...verifiedWeb,
        clientKey: "cli",
        hasSession: false,
        emailVerified: false,
        kind: "interactive",
      }).emailGate,
    ).toBe("none");
  });

  it("applies no policy to unknown clients", () => {
    expect(
      planAuthorizePolicy({
        ...verifiedWeb,
        clientKey: null,
        kind: "headless",
      }),
    ).toBe(NO_AUTHORIZE_POLICY);
  });
});
