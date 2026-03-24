"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { SwaggerPoweredByNote } from "@/components/developers/swagger-powered-by-note";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Iframe target: no site header/footer (avoids nested chrome). */
const IFRAME_SRC = "/docs/saas-openapi/embed";

/** Full-page docs with header/footer (open in new tab). */
const OPENAPI_FULL_PAGE_HREF = "/docs/saas-openapi";

/**
 * Full-height Swagger UI embed for the authenticated Developers page (iframe + skeleton,
 * open in new tab, theme sync on the iframe document).
 */
export function OpenApiExplorerEmbed() {
  const t = useTranslations("Developers.openApiEmbed");
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const handleIframeLoad = useCallback(() => {
    setIsIframeLoaded(true);
  }, []);

  useEffect(() => {
    if (!resolvedTheme) return;
    const iframe = iframeRef.current;
    if (!iframe || !isIframeLoaded) return;
    try {
      const doc = iframe.contentDocument;
      if (doc?.documentElement) {
        doc.documentElement.setAttribute(
          "data-theme",
          resolvedTheme === "dark" ? "dark" : "light",
        );
        doc.documentElement.classList.toggle("dark", resolvedTheme === "dark");
        if (resolvedTheme === "dark") {
          doc.documentElement.classList.add("dark-mode");
        } else {
          doc.documentElement.classList.remove("dark-mode");
        }
      }
    } catch {
      // cross-origin — ignore
    }
  }, [resolvedTheme, isIframeLoaded]);

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[480px] min-w-0 flex-col animate-fade-in-up opacity-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <SwaggerPoweredByNote className="min-w-0" />
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <a
            href={OPENAPI_FULL_PAGE_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("openInNewTab")}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </a>
        </Button>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border">
        {!isIframeLoaded && (
          <Skeleton
            className="absolute inset-0 z-[1] h-full w-full rounded-none"
            aria-hidden
          />
        )}
        <iframe
          ref={iframeRef}
          src={IFRAME_SRC}
          className="h-full w-full"
          title={t("iframeTitle")}
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}
