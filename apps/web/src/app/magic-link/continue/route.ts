import { NextResponse } from "next/server";

import { decodeMagicLinkContinuation } from "@/lib/auth/magic-link-callback";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = decodeMagicLinkContinuation(
    url.searchParams.get("flow") ?? undefined,
  );

  return NextResponse.redirect(new URL(callbackUrl ?? "/", request.url), 302);
}
