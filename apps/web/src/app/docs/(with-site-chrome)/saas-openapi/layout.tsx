import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DocsHub");
  return {
    title: `Masumi — ${t("saasOpenApiPageTitle")}`,
    description: t("saasOpenApiPageDescription"),
  };
}

export default function SaasOpenApiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
