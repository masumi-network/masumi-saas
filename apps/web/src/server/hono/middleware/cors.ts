import { createMiddleware } from "hono/factory";

import { corsHeaders, type CorsOptions } from "@/lib/api/cors";

/**
 * Hono CORS middleware that applies our existing `corsHeaders()` policy to
 * EVERY response on the route — preflight, success, and error responses
 * emitted by `handleApiError`. The error-path coverage is the main reason
 * for using middleware instead of decorating individual returns.
 */
export function honoCors(methods?: readonly string[], options?: CorsOptions) {
  return createMiddleware(async (c, next) => {
    const request = c.req.raw;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, methods, options),
      });
    }
    await next();
    const headers = corsHeaders(request, methods, options);
    for (const [key, value] of Object.entries(headers)) {
      c.res.headers.set(key, value);
    }
  });
}
