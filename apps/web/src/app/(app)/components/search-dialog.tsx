"use client";

import {
  Activity,
  ArrowLeftRight,
  Bell,
  BookOpen,
  Bot,
  Building2,
  CircleDollarSign,
  Code,
  Coins,
  ExternalLink,
  History,
  Inbox,
  Key,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Shield,
  TrendingUp,
  User,
  Wallet,
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

import { AgentIcon } from "@/components/agent-icon";
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
import { canAccessX402Workspace } from "@/lib/auth/org-roles";
import { useOrganizationContext } from "@/lib/context/organization-context";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavigationItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra filter tokens for cmdk; keep `value` as `key` for stable selection identity. */
  searchKeywords?: string[];
  requiresX402Access?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: LayoutDashboard,
    searchKeywords: ["home", "dashboard"],
  },
  {
    key: "agents",
    href: "/ai-agents",
    icon: Bot,
    searchKeywords: ["ai", "agents", "artificial intelligence"],
  },
  {
    key: "inboxAgents",
    href: "/inbox-agents",
    icon: Inbox,
    searchKeywords: ["inbox", "messages", "inboxes"],
  },
  {
    key: "activity",
    href: "/activity",
    icon: Activity,
    searchKeywords: ["activity", "history", "events", "transactions"],
  },
  {
    key: "earnings",
    href: "/earnings",
    icon: TrendingUp,
    searchKeywords: ["earnings", "revenue", "income", "money"],
  },
  {
    key: "x402",
    href: "/x402",
    icon: Coins,
    requiresX402Access: true,
    searchKeywords: [
      "x402",
      "evm",
      "chains",
      "wallets",
      "budgets",
      "alerts",
      "payments",
      "stablecoin",
      "facilitator",
      "payment rail",
    ],
  },
  {
    key: "x402Chains",
    href: "/x402?tab=Chains",
    icon: Link2,
    requiresX402Access: true,
    searchKeywords: ["x402", "chains", "evm", "rpc", "network"],
  },
  {
    key: "x402Wallets",
    href: "/x402?tab=Wallets",
    icon: Wallet,
    requiresX402Access: true,
    searchKeywords: [
      "x402",
      "wallets",
      "evm",
      "managed",
      "purchasing",
      "selling",
    ],
  },
  {
    key: "x402Budgets",
    href: "/x402?tab=Budgets",
    icon: CircleDollarSign,
    requiresX402Access: true,
    searchKeywords: ["x402", "budgets", "spend", "limits", "api key"],
  },
  {
    key: "x402Alerts",
    href: "/x402?tab=Alerts",
    icon: Bell,
    requiresX402Access: true,
    searchKeywords: ["x402", "alerts", "low balance", "webhook"],
  },
  {
    key: "x402Payments",
    href: "/x402?tab=Payments",
    icon: ArrowLeftRight,
    requiresX402Access: true,
    searchKeywords: ["x402", "payments", "verify", "settle"],
  },
  {
    key: "x402Setup",
    href: "/x402-setup",
    icon: Coins,
    requiresX402Access: true,
    searchKeywords: ["x402", "setup", "onboarding", "evm rail"],
  },
  {
    key: "topUp",
    href: "/top-up",
    icon: CircleDollarSign,
    searchKeywords: ["credits", "balance", "billing", "funds", "topup"],
  },
  {
    key: "organizations",
    href: "/organizations",
    icon: Building2,
    searchKeywords: ["organizations", "teams", "workspace"],
  },
  {
    key: "apiKeys",
    href: "/api-keys",
    icon: Key,
    searchKeywords: ["api", "keys", "token", "authentication"],
  },
  {
    key: "developers",
    href: "/developers",
    icon: Code,
    searchKeywords: [
      "openapi",
      "api",
      "documentation",
      "swagger",
      "rest",
      "http",
      "masumi",
      "saas",
      "developers",
    ],
  },
  {
    key: "account",
    href: "/account",
    icon: User,
    searchKeywords: ["account", "profile", "settings", "user"],
  },
];

const quickActions: NavigationItem[] = [
  {
    key: "documentation",
    href: "https://docs.masumi.network/",
    icon: BookOpen,
  },
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
  const { activeOrganization, activeOrganizationId } = useOrganizationContext();
  const canAccessX402 = canAccessX402Workspace(
    activeOrganizationId,
    activeOrganization?.role,
  );
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [, startTransition] = useTransition();

  const visibleNavigationItems = useMemo(
    () =>
      navigationItems.filter(
        (item) => !item.requiresX402Access || canAccessX402,
      ),
    [canAccessX402],
  );

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
            <CommandGroup
              heading={t("agents")}
              className="animate-list-item-in"
              style={{ animationDelay: "0ms" }}
            >
              {agentResults.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`agent-${agent.id}-${agent.name}`}
                  onSelect={() => handleSelect(`/ai-agents/${agent.id}`)}
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
        <CommandGroup
          heading={t("navigation")}
          className="animate-list-item-in"
          style={{ animationDelay: "50ms" }}
        >
          {visibleNavigationItems.map((item) => (
            <CommandItem
              key={item.key}
              value={`${item.key} ${t(`items.${item.key}`)}`}
              keywords={item.searchKeywords}
              onSelect={() => handleSelect(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {t(`items.${item.key}`)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup
          heading={t("quickActions")}
          className="animate-list-item-in"
          style={{ animationDelay: "100ms" }}
        >
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
        <CommandGroup
          heading={t("links")}
          className="animate-list-item-in"
          style={{ animationDelay: "150ms" }}
        >
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
