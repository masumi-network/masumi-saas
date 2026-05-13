import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import ForgotPasswordForm from "./components/form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.ForgotPassword");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
