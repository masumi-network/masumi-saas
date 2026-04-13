import type { Metadata } from "next";
import { cookies } from "next/headers";

import {
  type AuthPageSearchParams,
  resolveAuthPageCallbackUrl,
} from "@/lib/auth/auth-page-callback-url";

import SignUpForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Register",
  description: "Register for a Masumi account",
};

function getEnabledOAuthProviders(): ("google" | "github" | "microsoft")[] {
  const providers: ("google" | "github" | "microsoft")[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push("google");
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push("github");
  }
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.push("microsoft");
  }
  return providers;
}

interface SignUpPageProps {
  searchParams: Promise<AuthPageSearchParams>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const cookieStore = await cookies();
  const callbackUrl = resolveAuthPageCallbackUrl(
    await searchParams,
    cookieStore.get("oidc_login_prompt")?.value,
  );

  return (
    <SignUpForm
      oauthProviders={getEnabledOAuthProviders()}
      callbackUrl={callbackUrl}
    />
  );
}
