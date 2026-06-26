"use client";

import { useTranslations } from "next-intl";

import { Switch } from "@/components/ui/switch";

export function X402TestnetField({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("App.X402.Chains");

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{t("fields.testnet")}</p>
        <p className="text-xs text-muted-foreground">{t("testnetHint")}</p>
      </div>
      <Switch
        aria-label={t("fields.testnet")}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
