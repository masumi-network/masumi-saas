import type { OidcClientKey } from "@/lib/config/oidc-scopes.config";

const AUTHORIZE_PATH_SUFFIX = "/oauth2/authorize";

/**
 * How an `/oauth2/authorize` run reached the provider:
 * - `interactive`: a top-level browser navigation to the authorize URL.
 * - `headless`: a direct fetch/XHR or JSON caller of the authorize URL.
 * - `resumed`: the provider re-ran authorize inside another request
 *   (sign-in completion or consent submit); the caller expects JSON.
 */
export type AuthorizeRequestKind = "interactive" | "headless" | "resumed";

export function classifyAuthorizeRequest(
  requestUrl: string | undefined,
  headers: Headers | undefined,
): AuthorizeRequestKind {
  if (!requestUrl) {
    return "headless";
  }

  const pathname = new URL(requestUrl).pathname.replace(/\/+$/, "");
  if (!pathname.endsWith(AUTHORIZE_PATH_SUFFIX)) {
    return "resumed";
  }

  if (headers?.get("sec-fetch-mode") === "cors") {
    return "headless";
  }

  const accept = headers?.get("accept") ?? "";
  return accept.includes("application/json") ? "headless" : "interactive";
}

export function parsePromptValues(prompt: unknown): Set<string> {
  return new Set(
    typeof prompt === "string" ? prompt.split(" ").filter(Boolean) : [],
  );
}

/**
 * `redirect`: send the browser to the client's redirect URI with an error.
 * `json-redirect`: same target, as a `{ redirect, url }` body for a JSON caller.
 * `forbidden`: 403 JSON error for a headless caller.
 */
export type EmailGateAction =
  | "none"
  | "redirect"
  | "json-redirect"
  | "forbidden";

export type AuthorizePolicyPlan = {
  /** Add `consent` to `prompt` so the web client always shows the consent page. */
  forceConsentPrompt: boolean;
  /** Drop API scopes the user has not granted yet (no consent page will ask). */
  enforceStoredGrants: boolean;
  emailGate: EmailGateAction;
  /** Record consent for a headless first-party web request (no consent page). */
  autoConsent: boolean;
};

export const NO_AUTHORIZE_POLICY: AuthorizePolicyPlan = {
  forceConsentPrompt: false,
  enforceStoredGrants: false,
  emailGate: "none",
  autoConsent: false,
};

/**
 * Decides the app policy for one authorize run of a first-party client.
 *
 * The web client shows the consent page for every interactive request, and
 * that page both gates unverified users and upgrades API grants. When no
 * consent page will be shown (CLI, headless, or resumed after consent),
 * requested API scopes are cut down to the grants the user already holds and
 * unverified users are refused here.
 */
export function planAuthorizePolicy(input: {
  clientKey: OidcClientKey | null;
  kind: AuthorizeRequestKind;
  prompt: Set<string>;
  hasSession: boolean;
  emailVerified: boolean;
}): AuthorizePolicyPlan {
  const { clientKey, kind, prompt, hasSession, emailVerified } = input;
  if (!clientKey) {
    return NO_AUTHORIZE_POLICY;
  }

  const forceConsentPrompt =
    clientKey === "web" &&
    kind === "interactive" &&
    !prompt.has("none") &&
    !prompt.has("consent");
  const consentPageWillShow =
    clientKey === "web" && (forceConsentPrompt || prompt.has("consent"));

  let emailGate: EmailGateAction = "none";
  if (hasSession && !emailVerified && !consentPageWillShow) {
    emailGate =
      kind === "interactive"
        ? "redirect"
        : kind === "resumed"
          ? "json-redirect"
          : "forbidden";
  }

  return {
    forceConsentPrompt,
    // Signed out, the provider only redirects to sign-in and resumes this
    // request afterwards. Filtering now would drop every API scope before the
    // user is known; the resumed run filters against the user's grants.
    enforceStoredGrants: hasSession && !consentPageWillShow,
    emailGate,
    autoConsent:
      clientKey === "web" &&
      kind === "headless" &&
      hasSession &&
      emailVerified &&
      !consentPageWillShow,
  };
}
