/** Routes that only make sense on the Cardano rail. */
export const CARDANO_ONLY_PAGES = [
  "/",
  "/inbox-agents",
  "/activity",
  "/earnings",
  "/ai-agents",
  "/integrations",
  "/verification",
  "/top-up",
  "/withdraw",
  "/organizations",
  "/onboarding",
  "/analytics",
  "/api-keys",
  "/developers",
  "/account",
] as const;

/** Routes that only make sense on the x402 (EVM) rail. */
export const X402_ONLY_PAGES = ["/x402"] as const;

export type CardanoOnlyPage = (typeof CARDANO_ONLY_PAGES)[number];
export type X402OnlyPage = (typeof X402_ONLY_PAGES)[number];

export function isCardanoOnlyPage(pathname: string): boolean {
  return (CARDANO_ONLY_PAGES as readonly string[]).some(
    (page) =>
      pathname === page || (page !== "/" && pathname.startsWith(`${page}/`)),
  );
}

export function isX402OnlyPage(pathname: string): boolean {
  return (X402_ONLY_PAGES as readonly string[]).some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}
