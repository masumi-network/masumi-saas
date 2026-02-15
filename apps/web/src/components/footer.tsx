import { Languages } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="secondary" size="sm">
          <Languages className="h-3 w-3" />
          <span className="text-xs sm:text-sm tracking-tight">{"English"}</span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="https://www.masumi.network/about"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
        >
          {t("about")}
        </Link>
        <Link
          href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
        >
          {t("privacyPolicy")}
        </Link>
        <Link
          href="https://www.masumi.network/legal"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
        >
          {t("legal")}
        </Link>
        <Link
          href="https://www.masumi.network/product-releases"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight"
        >
          {t("changelog")}
        </Link>
      </div>
    </div>
  );
}
