import { setCookie } from "hono/cookie";
import { z } from "zod";

import { locales } from "@/i18n/config";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

const schema = z.object({
  locale: z.enum(locales),
});

const app = createApiApp("/api/locale");

app.post("/", async (c) => {
  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid locale" }, 400);
  }

  const { locale } = parsed.data;
  setCookie(c, "NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return c.json({ locale });
});

export const { POST } = nextHandlers(app);
export default app;
