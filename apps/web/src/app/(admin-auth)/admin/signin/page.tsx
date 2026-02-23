import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import AdminSignInForm from "./components/form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Auth.SignIn");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default function AdminSignInPage() {
  return <AdminSignInForm />;
}
