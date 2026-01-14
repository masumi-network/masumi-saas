"use client";

import {
  BookOpen,
  Bot,
  Building2,
  CreditCard,
  ExternalLink,
  History,
  Key,
  LayoutDashboard,
  MessageSquare,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { FaDiscord, FaXTwitter } from "react-icons/fa6";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavigationItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationItems: NavigationItem[] = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "agents", href: "/agents", icon: Bot },
  { key: "organizations", href: "/organizations", icon: Building2 },
  { key: "wallets", href: "/wallets", icon: Wallet },
  { key: "paymentMethods", href: "/payment-methods", icon: CreditCard },
  { key: "apiKeys", href: "/api-keys", icon: Key },
  { key: "account", href: "/account", icon: User },
];

const quickActions: NavigationItem[] = [
  { key: "documentation", href: "https://docs.masumi.network", icon: BookOpen },
  {
    key: "support",
    href: "https://www.masumi.network/contact",
    icon: MessageSquare,
  },
];

const externalLinks: NavigationItem[] = [
  { key: "twitter", href: "https://x.com/MasumiNetwork", icon: FaXTwitter },
  {
    key: "discord",
    href: "https://discord.com/invite/aj4QfnTS92",
    icon: FaDiscord,
  },
  {
    key: "about",
    href: "https://www.masumi.network/about",
    icon: ExternalLink,
  },
  {
    key: "privacyPolicy",
    href: "https://www.house-of-communication.com/de/en/footer/privacy-policy.html",
    icon: Shield,
  },
  {
    key: "changelog",
    href: "https://www.masumi.network/product-releases",
    icon: History,
  },
];

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const t = useTranslations("App.Search");
  const router = useRouter();
  const [search, setSearch] = useState("");

  const handleSelect = useCallback(
    (href: string) => {
      onOpenChange(false);
      setSearch("");
      if (href.startsWith("http")) {
        window.open(href, "_blank");
      } else {
        router.push(href);
      }
    },
    [router, onOpenChange],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !open) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={t("placeholder")}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        <CommandGroup heading={t("navigation")}>
          {navigationItems.map((item) => (
            <CommandItem
              key={item.key}
              value={item.key}
              onSelect={() => handleSelect(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {t(`items.${item.key}`)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("quickActions")}>
          {quickActions.map((item) => (
            <CommandItem
              key={item.key}
              value={item.key}
              onSelect={() => handleSelect(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {t(`items.${item.key}`)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("links")}>
          {externalLinks.map((item) => (
            <CommandItem
              key={item.key}
              value={item.key}
              onSelect={() => handleSelect(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {t(`items.${item.key}`)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
