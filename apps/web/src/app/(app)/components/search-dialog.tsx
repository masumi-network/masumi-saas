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
  TrendingUp,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { FaDiscord, FaXTwitter } from "react-icons/fa6";

import { AgentIcon } from "@/app/agents/components/agent-icon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

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
  { key: "metrics", href: "/metrics", icon: TrendingUp },
  { key: "organizations", href: "/organizations", icon: Building2 },
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [, startTransition] = useTransition();

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
      const isTyping =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (e.key === "/" && !open && !isTyping) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await agentApiClient.getAgents();
      if (result.success && result.data) {
        setAgents(result.data);
      }
    });
  }, [open]);

  const agentResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return agents.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 5);
  }, [agents, search]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={t("placeholder")}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        {agentResults.length > 0 && (
          <>
            <CommandGroup heading={t("agents")}>
              {agentResults.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`agent-${agent.id}-${agent.name}`}
                  onSelect={() => handleSelect(`/agents/${agent.id}`)}
                >
                  <AgentIcon
                    icon={agent.icon}
                    name={agent.name}
                    className="mr-2 h-4 w-4 shrink-0"
                  />
                  {agent.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
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
