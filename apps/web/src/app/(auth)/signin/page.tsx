import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  type AuthPageSearchParams,
  resolveAuthPageCallbackUrl,
} from "@/lib/auth/auth-page-callback-url";
import { getAuthContext } from "@/lib/auth/utils";

import SignInForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Login",
  description: "Login to access the Masumi dashboard",
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

interface SignInPageProps {
  searchParams: Promise<AuthPageSearchParams>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const cookieStore = await cookies();
  const callbackUrl = resolveAuthPageCallbackUrl(
    await searchParams,
    cookieStore.get("oidc_login_prompt")?.value,
  );
  const authContext = await getAuthContext();

  if (authContext.isAuthenticated) {
    redirect(callbackUrl ?? "/");
  }

  return (
    <SignInForm
      oauthProviders={getEnabledOAuthProviders()}
      callbackUrl={callbackUrl}
    />
  );
}
