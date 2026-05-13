import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import ResetPasswordForm from "./components/form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.ResetPassword");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

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
