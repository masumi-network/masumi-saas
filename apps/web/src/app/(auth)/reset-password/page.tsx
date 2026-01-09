import type { Metadata } from "next";
import { redirect } from "next/navigation";

import ResetPasswordForm from "./components/form";

export const metadata: Metadata = {
  title: "Masumi - Reset Password",
  description: "Reset your password to regain access to your account",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/forgot-password");
  }

  return <ResetPasswordForm token={token} />;
}
