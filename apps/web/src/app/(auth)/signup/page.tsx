import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import SignUpForm from "./components/form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.SignUp");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

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

export default function SignUpPage() {
  return <SignUpForm oauthProviders={getEnabledOAuthProviders()} />;
}
