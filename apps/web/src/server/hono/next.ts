import type { Hono } from "hono";
import { handle } from "hono/vercel";

type NextRouteContext = { params: Promise<Record<string, string | string[]>> };
type NextHandler = (
  request: Request,
  context?: NextRouteContext,
) => Promise<Response>;

/**
 * URL aliases: incoming paths that should be rewritten to a canonical
 * `/api/...` path before Hono routing.
 *
 * /pay/api/v1/registry-inbox/agent-identifier maps to a different parent
 * tree, so it needs an explicit entry. Everything else is a clean prefix
 * substitution.
 */
const PATH_ALIASES: ReadonlyArray<{ from: string; to: string }> = [
  {
    from: "/pay/api/v1/registry-inbox/agent-identifier",
    to: "/api/registry-discovery/inbox-agent-identifier",
  },
  { from: "/pay/api/", to: "/api/" },
  { from: "/registry/api/", to: "/api/" },
  { from: "/credits", to: "/api/credits" },
];

function rewriteAliasedRequest(request: Request): Request {
  const url = new URL(request.url);
  for (const { from, to } of PATH_ALIASES) {
    if (url.pathname === from || url.pathname.startsWith(`${from}/`)) {
      url.pathname = to + url.pathname.slice(from.length);
      return new Request(url, request);
    }
    if (url.pathname.startsWith(from)) {
      url.pathname = to + url.pathname.slice(from.length);
      return new Request(url, request);
    }
  }
  return request;
}

/**
 * Bind a Hono app to Next.js App Router method exports.
 * Pass only the methods the underlying route actually registers — extra
 * exports would invite Next to call into Hono for unsupported methods.
 *
 * Aliased URLs (under /pay/api/* and /registry/api/*) are rewritten to
 * their canonical /api/* path before being handed to Hono, so each route
 * needs only one app with one basePath.
 */
// Hono's generic uses three positional `any`s; mirrored here so callers can
// pass any OpenAPIHono/Hono instance without specialised generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function nextHandlers<TApp extends Hono<any, any, any>>(
  app: TApp,
): {
  GET: NextHandler;
  POST: NextHandler;
  PUT: NextHandler;
  PATCH: NextHandler;
  DELETE: NextHandler;
  OPTIONS: NextHandler;
  HEAD: NextHandler;
} {
  const vercelAdapter = handle(app) as unknown as NextHandler;
  const adapter: NextHandler = (request, context) =>
    vercelAdapter(rewriteAliasedRequest(request), context);

  return {
    GET: adapter,
    POST: adapter,
    PUT: adapter,
    PATCH: adapter,
    DELETE: adapter,
    OPTIONS: adapter,
    HEAD: adapter,
  };
}
