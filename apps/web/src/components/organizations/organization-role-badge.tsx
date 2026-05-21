"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

// All current callers (organizations-content, members-section,
// pending-invitations-list, organization-detail-content,
// organization-dashboard-overview) are client components and render this
// inline (`<OrganizationRoleBadge role={...} />`), so it has to stay a
// client component — async server components can't be rendered inline from
// a client tree.
export function OrganizationRoleBadge({ role }: { role: string | null }) {
  const t = useTranslations("App.Organizations.Role");

  if (!role) return null;

  const normalizedRole = role.toLowerCase();

  if (normalizedRole === "owner") {
    return <Badge variant="primary-muted">{t("owner")}</Badge>;
  }

  if (normalizedRole === "admin") {
    return <Badge variant="secondary-muted">{t("admin")}</Badge>;
  }

  return <Badge variant="outline-muted">{t("member")}</Badge>;
}
