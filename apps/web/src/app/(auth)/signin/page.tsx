import type { Metadata } from "next";

import SignInForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Login",
  description: "Login to access the Masumi dashboard",
};

function getEnabledOAuthProviders(): (
  | "google"
  | "github"
  | "microsoft"
  | "apple"
)[] {
  const providers: ("google" | "github" | "microsoft" | "apple")[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push("google");
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push("github");
  }
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.push("microsoft");
  }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.push("apple");
  }
  return providers;
}

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams;
  return (
    <SignInForm
      oauthProviders={getEnabledOAuthProviders()}
      callbackUrl={callbackUrl}
    />
  );
}
