/**
 * Parameter names the provider uses in a signed authorize query
 * (`@better-auth/oauth-provider` src/signed-query.ts, not exported).
 */
const SIGNATURE_PARAM = "sig";
const SIGNED_PARAM_NAMES_PARAM = "ba_param";
const PROVIDER_ONLY_PARAMS = new Set([
  SIGNATURE_PARAM,
  SIGNED_PARAM_NAMES_PARAM,
  "exp",
  "ba_iat",
  "ba_pl",
]);

const AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

/**
 * Returns the signed part of a consent-page query, the value the provider
 * expects as `oauth_query`. Extra params the app adds to the page URL (for
 * example `error`) are dropped so the signature still verifies. Returns null
 * when the query carries no signature.
 */
export function extractSignedOAuthQuery(
  params: URLSearchParams,
): string | null {
  if (!params.has(SIGNATURE_PARAM)) return null;
  const signedNames = new Set(params.getAll(SIGNED_PARAM_NAMES_PARAM));
  if (signedNames.size === 0) return null;

  const signed = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (
      key === SIGNATURE_PARAM ||
      key === SIGNED_PARAM_NAMES_PARAM ||
      signedNames.has(key)
    ) {
      signed.append(key, value);
    }
  }
  return signed.toString();
}

/**
 * Rebuilds the authorize URL from a signed consent query, without the
 * provider's signature params. Used to resume the flow after the user
 * verifies their email or switches account.
 */
export function buildAuthorizeUrlFromSignedQuery(oauthQuery: string): string {
  const params = new URLSearchParams(oauthQuery);
  for (const name of PROVIDER_ONLY_PARAMS) {
    params.delete(name);
  }
  return `${AUTHORIZE_PATH}?${params.toString()}`;
}
