import { createMiddleware } from "hono/factory";

import {
  type AuthenticatedApiContext,
  type GetAuthenticatedOptions,
  getAuthenticatedOrThrow,
} from "@/lib/auth/utils";

export type AuthVariables = {
  auth: AuthenticatedApiContext;
};

export function authenticated(options?: GetAuthenticatedOptions) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const auth = await getAuthenticatedOrThrow(c.req.raw, options);
    c.set("auth", auth);
    await next();
  });
}
