import type { Metadata } from "next";

import SignUpForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Register",
  description: "Register for a Masumi account",
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

export default function SignUpPage() {
  return <SignUpForm oauthProviders={getEnabledOAuthProviders()} />;
}
