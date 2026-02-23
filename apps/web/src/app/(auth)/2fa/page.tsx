import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import TwoFactorForm from "./components/two-factor-form";

export const metadata: Metadata = {
  title: "Masumi - Two-Factor Authentication",
  description: "Verify your identity with two-factor authentication.",
};

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
