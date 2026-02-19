export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  sokosumiMarketplaceUrl:
    process.env.NEXT_PUBLIC_SOKOSUMI_MARKETPLACE_URL ||
    "https://app.sokosumi.com",
} as const;
