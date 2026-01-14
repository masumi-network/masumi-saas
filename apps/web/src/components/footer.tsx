import { ArrowUpRightFromSquare, Languages } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sectionsData = [
  {
    name: "Navigate",
    items: [
      { key: "dashboard", href: "/", showExternalLinkIcon: false },
      {
        key: "documentation",
        href: "https://docs.masumi.network",
        showExternalLinkIcon: true,
      },
    ],
  },
  {
    name: "Connect",
    items: [
      {
        key: "twitter",
        href: "https://x.com/MasumiNetwork",
        showExternalLinkIcon: false,
      },
      {
        key: "discord",
        href: "https://discord.com/invite/aj4QfnTS92",
        showExternalLinkIcon: false,
      },
    ],
  },
  {
    name: "GetInTouch",
    items: [
      {
        key: "contact",
        href: "https://www.masumi.network/contact",
        showExternalLinkIcon: false,
      },
      {
        key: "support",
        href: "https://www.masumi.network/contact",
        showExternalLinkIcon: true,
      },
    ],
  },
  {
    name: "Services",
    items: [
      {
        key: "sokosumi",
        href: "https://sokosumi.com",
        showExternalLinkIcon: true,
      },
      {
        key: "kodosumi",
        href: "https://kodosumi.io",
        showExternalLinkIcon: true,
      },
    ],
  },
];

interface FooterProps {
  className?: string | undefined;
}

export default function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("space-y-6", className)}>
      <FooterSections className="container mx-auto px-4 pt-14 md:px-12 md:pt-12" />
    </footer>
  );
}

interface FooterSectionsProps {
  className?: string;
}

export function FooterSections({ className }: FooterSectionsProps) {
  const t = useTranslations("Footer");

  return (
    <div className={cn("space-y-16 md:space-y-24", className)}>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        {sectionsData.map(({ name, items }) => (
          <div className="border-t pt-8" key={name}>
            <h3 className="mb-4 text-sm font-medium uppercase md:text-base">
              {t(`${name}.title`)}
            </h3>
            <ul className="space-y-2">
              {items.map(({ key, href, showExternalLinkIcon }) => (
                <li key={key}>
                  <Link
                    href={href}
                    className={cn({
                      "flex items-center gap-1 text-sm md:text-base":
                        showExternalLinkIcon,
                    })}
                  >
                    {t(`${name}.${key}`)}
                    {showExternalLinkIcon && (
                      <ArrowUpRightFromSquare className="h-4 w-4" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mb-24 flex flex-wrap items-center gap-4 md:mb-0">
        <div className="flex w-full items-center justify-between gap-4 md:w-auto">
          <ThemeToggle />
          <Button variant="secondary">
            <Languages className="h-4 w-4" />
            <span>{"English"}</span>
          </Button>
        </div>
        <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-start">
          <Link
            href="https://www.masumi.network/about"
            className="text-sm hover:text-gray-300"
          >
            {t("about")}
          </Link>
          <Link
            href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
            className="text-sm hover:text-gray-300"
          >
            {t("privacyPolicy")}
          </Link>
          <Link
            href="https://www.masumi.network/product-releases"
            className="text-sm hover:text-gray-300"
          >
            {t("changelog")}
          </Link>
        </div>
      </div>
    </div>
  );
}
