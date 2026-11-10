import {
  getOAuthProviderApi,
  type OAuthOptions,
  type Scope,
} from "@better-auth/oauth-provider";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { z } from "zod";

import {
  getTrustedOidcClient,
  oidcEnvConfig,
  resolveOidcClientKey,
} from "@/lib/config/oidc.config";
import {
  OIDC_STANDARD_SCOPES,
  serializeScopeList,
} from "@/lib/config/oidc-scopes.config";

import {
  addUserOidcGrantScopes,
  resolveOidcScopeGrantSet,
} from "../oidc-user-grants";
import {
  classifyAuthorizeRequest,
  parsePromptValues,
  planAuthorizePolicy,
} from "./authorize-policy";
import {
  OIDC_ACCESS_DENIED,
  OIDC_EMAIL_VERIFICATION_REQUIRED,
  OIDC_NO_STORE_HEADERS,
} from "./constants";
import { logOidcScopeResolution } from "./scope-log";

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const OAUTH_CONSENT_MODEL = "oauthConsent";
const DEVICE_CODE_MODEL = "deviceCode";

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
type DeviceCodeRecord = {
  id: string;
  userId?: string | null;
  status: string;
  expiresAt: Date;
  clientId?: string | null;
  oauthClientId?: string | null;
  scope?: string | null;
};

function emailVerificationRequiredError(): APIError {
  return new APIError(
    "FORBIDDEN",
    {
      error: OIDC_ACCESS_DENIED,
      error_description: OIDC_EMAIL_VERIFICATION_REQUIRED,
    },
    OIDC_NO_STORE_HEADERS,
  );
}

function getProviderOptions(ctx: HookContext): OAuthOptions<Scope[]> {
  const provider = ctx.context.getPlugin("oauth-provider") as {
    options?: OAuthOptions<Scope[]>;
  } | null;
  if (!provider?.options) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "oauth-provider plugin is not installed",
    });
  }
  return provider.options;
}

/** Same lookup the device plugin uses: exact code, then normalized. */
async function findDeviceCodeByUserCode(
  ctx: HookContext,
  userCode: string,
): Promise<DeviceCodeRecord | null> {
  const find = (value: string) =>
    ctx.context.adapter.findOne<DeviceCodeRecord>({
      model: DEVICE_CODE_MODEL,
      where: [{ field: "userCode", value }],
    });
  const normalized = userCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (
    (await find(userCode)) ??
    (normalized !== userCode ? await find(normalized) : null)
  );
}

/**
 * better-auth 1.7 requires a device code to be claimed (viewed by the
 * signed-in user) before approve/deny. API callers that approve directly keep
 * working: an unclaimed pending code is claimed for the current user first.
 * Only an unclaimed code can be claimed, so this never steals one.
 */
async function claimDeviceCodeIfUnclaimed(
  ctx: HookContext,
  userId: string,
  record: DeviceCodeRecord,
): Promise<void> {
  if (record.userId || record.status !== "pending") return;
  if (record.expiresAt < new Date()) return;
  await ctx.context.adapter.incrementOne({
    model: DEVICE_CODE_MODEL,
    where: [
      { field: "id", value: record.id },
      { field: "status", value: "pending" },
      { field: "userId", operator: "eq", value: null },
    ],
    increment: {},
    set: { userId },
  });
}

function buildRedirectUriError(
  query: Record<string, unknown>,
  clientKey: "web" | "cli",
): string | null {
  const redirectUri =
    typeof query.redirect_uri === "string" ? query.redirect_uri : null;
  if (
    !redirectUri ||
    !getTrustedOidcClient(clientKey).redirectUrls.includes(redirectUri)
  ) {
    return null;
  }
  const url = new URL(redirectUri);
  url.searchParams.set("error", OIDC_ACCESS_DENIED);
  url.searchParams.set("error_description", OIDC_EMAIL_VERIFICATION_REQUIRED);
  if (typeof query.state === "string") {
    url.searchParams.set("state", query.state);
  }
  return url.toString();
}

async function upsertHeadlessConsent(
  ctx: HookContext,
  userId: string,
  clientId: string,
  scopes: string[],
): Promise<void> {
  const where = [
    { field: "clientId", value: clientId },
    { field: "userId", value: userId },
  ];
  const existing = await ctx.context.adapter.findOne<{ id: string }>({
    model: OAUTH_CONSENT_MODEL,
    where,
  });
  const now = new Date();
  if (existing) {
    await ctx.context.adapter.update({
      model: OAUTH_CONSENT_MODEL,
      where: [{ field: "id", value: existing.id }],
      update: { scopes, updatedAt: now },
    });
    return;
  }
  await ctx.context.adapter.create({
    model: OAUTH_CONSENT_MODEL,
    data: { clientId, userId, scopes, createdAt: now, updatedAt: now },
  });
}

/**
 * App policy for `/oauth2/authorize`: API-scope filtering against stored
 * grants, forced consent for the interactive web client, the email
 * verification gate, and headless first-party consent.
 */
async function applyAuthorizePolicy(ctx: HookContext) {
  const kind = classifyAuthorizeRequest(ctx.request?.url, ctx.headers);
  // The provider reads a direct POST to /oauth2/authorize from the body and
  // every other run (GET, or a resumed run) from the query. Filter the same
  // source, or a POST would skip this policy.
  const fromBody = ctx.method === "POST" && kind !== "resumed";
  const source = fromBody ? ctx.body : ctx.query;
  const query = {
    ...(source && typeof source === "object" ? source : {}),
  } as Record<string, unknown>;
  const clientId = typeof query.client_id === "string" ? query.client_id : "";
  const clientKey = resolveOidcClientKey(clientId);
  if (!clientKey) return;

  const session = await getSessionFromCtx(ctx);
  const prompt = parsePromptValues(query.prompt);
  const plan = planAuthorizePolicy({
    clientKey,
    kind,
    prompt,
    hasSession: Boolean(session?.user),
    emailVerified: session?.user?.emailVerified === true,
  });

  if (plan.emailGate !== "none") {
    const errorUrl = buildRedirectUriError(query, clientKey);
    if (errorUrl && plan.emailGate === "redirect") {
      throw ctx.redirect(errorUrl);
    }
    if (errorUrl && plan.emailGate === "json-redirect") {
      return ctx.json({ redirect: true, url: errorUrl });
    }
    throw emailVerificationRequiredError();
  }

  const resolution = await resolveOidcScopeGrantSet({
    clientId,
    requestedScopes: typeof query.scope === "string" ? query.scope : "openid",
    userId: session?.user?.id,
    enforceStoredGrants: plan.enforceStoredGrants,
  });
  logOidcScopeResolution("authorize-request", clientId, resolution, {
    userId: session?.user?.id ?? null,
  });
  query.scope = serializeScopeList(resolution.finalScopes);
  if (plan.forceConsentPrompt) {
    query.prompt = [...prompt, "consent"].join(" ");
  }

  if (plan.autoConsent && session?.user) {
    await upsertHeadlessConsent(
      ctx,
      session.user.id,
      clientId,
      resolution.finalScopes,
    );
  }

  return { context: fromBody ? { body: query } : { query } };
}

async function applyDeviceCodeScopePolicy(ctx: HookContext) {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!resolveOidcClientKey(clientId)) return;

  const resolution = await resolveOidcScopeGrantSet({
    clientId,
    requestedScopes: typeof body.scope === "string" ? body.scope : "openid",
    enforceStoredGrants: false,
  });
  logOidcScopeResolution("device-code-request", clientId, resolution);
  const scope = serializeScopeList(resolution.finalScopes);

  // The device plugin re-reads form-encoded fields from the raw request, so
  // the filtered scope must go into a rebuilt request, not only into `body`.
  const request = ctx.request;
  const isForm = request?.headers
    .get("content-type")
    ?.includes("application/x-www-form-urlencoded");
  if (!request || !isForm) {
    return { context: { body: { ...body, scope } } };
  }
  const form = new URLSearchParams(await request.clone().text());
  form.set("scope", scope);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return {
    context: {
      body: { ...body, scope },
      request: new Request(request.url, {
        method: request.method,
        headers,
        body: form.toString(),
      }),
    },
  };
}

async function guardDeviceDecision(ctx: HookContext, requireVerified: boolean) {
  const session = await getSessionFromCtx(ctx);
  if (!session?.user) return;
  if (requireVerified && session.user.emailVerified !== true) {
    throw emailVerificationRequiredError();
  }
  const userCode = (ctx.body as { userCode?: unknown } | undefined)?.userCode;
  if (typeof userCode !== "string") return;
  const record = await findDeviceCodeByUserCode(ctx, userCode);
  if (record) {
    await claimDeviceCodeIfUnclaimed(ctx, session.user.id, record);
  }
}

async function recordApprovedDeviceScopes(ctx: HookContext) {
  const returned = ctx.context.returned as { success?: unknown } | undefined;
  if (!returned || returned.success !== true) return;
  const session = await getSessionFromCtx(ctx);
  const userCode = (ctx.body as { userCode?: unknown } | undefined)?.userCode;
  if (!session?.user || typeof userCode !== "string") return;
  const record = await findDeviceCodeByUserCode(ctx, userCode);
  const clientId = record?.oauthClientId ?? record?.clientId;
  if (!record || !clientId || record.userId !== session.user.id) return;
  await addUserOidcGrantScopes({
    userId: session.user.id,
    clientId,
    scopes: record.scope ?? "",
  });
}

async function guardDeviceTokenGrant(ctx: HookContext) {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (body.grant_type !== DEVICE_CODE_GRANT) return;
  if (typeof body.device_code !== "string") return;
  const record = await ctx.context.adapter.findOne<DeviceCodeRecord>({
    model: DEVICE_CODE_MODEL,
    where: [{ field: "deviceCode", value: body.device_code }],
  });
  if (!record?.userId || record.status !== "approved") return;
  const user = await ctx.context.internalAdapter.findUserById(record.userId);
  if (user && user.emailVerified !== true) {
    throw emailVerificationRequiredError();
  }
}

/**
 * Masumi policy on top of `@better-auth/oauth-provider`: grant-aware scope
 * filtering, email-verification gates, device grant bookkeeping, plus two
 * server-only endpoints (session bridge token issuance and access-token
 * validation for the app's own API).
 */
export const masumiOidcPolicy = () =>
  ({
    id: "masumi-oidc-policy",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/authorize",
          handler: createAuthMiddleware(applyAuthorizePolicy),
        },
        {
          matcher: (ctx) => ctx.path === "/device/code",
          handler: createAuthMiddleware(applyDeviceCodeScopePolicy),
        },
        {
          matcher: (ctx) => ctx.path === "/device/approve",
          handler: createAuthMiddleware((ctx) =>
            guardDeviceDecision(ctx, true),
          ),
        },
        {
          matcher: (ctx) => ctx.path === "/device/deny",
          handler: createAuthMiddleware((ctx) =>
            guardDeviceDecision(ctx, false),
          ),
        },
        {
          matcher: (ctx) => ctx.path === "/oauth2/token",
          handler: createAuthMiddleware(guardDeviceTokenGrant),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/device/approve",
          handler: createAuthMiddleware(recordApprovedDeviceScopes),
        },
      ],
    },
    endpoints: {
      /**
       * Issues an OIDC token set for the caller's browser session (the
       * SpacetimeDB session bridge). API scopes are limited to stored grants.
       */
      masumiIssueOidcSessionTokens: createAuthEndpoint(
        "/masumi/oidc/session-tokens",
        {
          method: "POST",
          body: z.object({ client: z.enum(["web", "cli"]) }),
          use: [sessionMiddleware],
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          const clientId = oidcEnvConfig[ctx.body.client].clientId;
          const resolution = await resolveOidcScopeGrantSet({
            clientId,
            requestedScopes: [...OIDC_STANDARD_SCOPES],
            userId: user.id,
            enforceStoredGrants: true,
          });
          const provider = getOAuthProviderApi(
            ctx,
            getProviderOptions(ctx),
            "authorization_code",
          );
          const client = await provider.getClient(clientId);
          if (!client || client.disabled) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: `OIDC client ${clientId} is not available`,
            });
          }
          const token = await provider.issueTokens({
            client,
            user,
            scopes: resolution.finalScopes,
            sessionId: session.id,
            authTime: new Date(session.createdAt),
          });
          return ctx.json({ clientId, token });
        },
      ),
      /** RFC 7662-style validation of an access token for the app's API. */
      masumiValidateOidcAccessToken: createAuthEndpoint(
        "/masumi/oidc/validate-access-token",
        {
          method: "POST",
          body: z.object({ token: z.string().min(1) }),
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          // The app API accepts opaque tokens only. A JWT access token (issued
          // when a client sends `resource`) is stateless, so revoking the
          // client connection would not end it.
          if (ctx.body.token.includes(".")) {
            return ctx.json({ active: false } as Record<string, unknown>);
          }
          const provider = getOAuthProviderApi(ctx, getProviderOptions(ctx));
          try {
            const payload = await provider.validateAccessToken(ctx.body.token);
            return ctx.json(payload as Record<string, unknown>);
          } catch (error) {
            if (error instanceof APIError) {
              return ctx.json({ active: false } as Record<string, unknown>);
            }
            throw error;
          }
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
