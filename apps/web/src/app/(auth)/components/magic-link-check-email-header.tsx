"use client";

import { useTranslations } from "next-intl";

import { AuthPageHeader } from "@/components/auth-page-header";

type MagicLinkCheckEmailHeaderProps = {
  email: string;
  isOidcFlow: boolean;
  namespace: "Auth.SignIn" | "Auth.SignUp";
};

export function MagicLinkCheckEmailHeader({
  email,
  isOidcFlow,
  namespace,
}: MagicLinkCheckEmailHeaderProps) {
  const t = useTranslations(namespace);
  const descriptionKey = isOidcFlow
    ? "checkEmail.oidcDescription"
    : "checkEmail.description";

  return (
    <AuthPageHeader
      title={t("checkEmail.title")}
      description={t.rich(descriptionKey, {
        email,
        emailEmphasis: (chunks) => (
          <span className="font-semibold text-foreground">{chunks}</span>
        ),
      })}
    />
  );
}
