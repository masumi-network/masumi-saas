import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import TwoFactorForm from "./components/two-factor-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.TwoFactor");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function TwoFactorPage() {
  // Guard: only render if there's an active 2FA challenge cookie
  const cookieStore = await cookies();
  const hasTwoFactorChallenge = cookieStore
    .getAll()
    .some((c) => c.name === "better-auth.two_factor");

  if (!hasTwoFactorChallenge) {
    redirect("/signin");
  }

  return <TwoFactorForm />;
}
