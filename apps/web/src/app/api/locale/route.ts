import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { locales } from "@/i18n/config";

const schema = z.object({
  locale: z.enum(locales),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const { locale } = parsed.data;
  const res = NextResponse.json({ locale });
  res.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
