import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DocsHub");
  return {
    title: `Masumi — ${t("openApiPageTitle")}`,
    description: t("openApiPageDescription"),
  };
}

export default function OpenApiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
