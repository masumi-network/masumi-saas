import { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="max-w-container mx-auto flex min-h-screen w-full flex-col justify-center gap-16 p-8 md:p-16">
      <div className="space-y-4">
        <h1 className="text-9xl leading-none">{t("title")}</h1>
        <h2 className="text-6xl text-masumi-iris-flower">{t("description")}</h2>
      </div>
      <div className="space-y-6">
        <p className="text-lg">{t("message")}</p>
        <Button asChild size="lg" className="w-fit">
          <Link href="/">{t("returnHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
