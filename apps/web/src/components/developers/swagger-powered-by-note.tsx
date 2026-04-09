"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type SwaggerPoweredByNoteProps = {
  className?: string;
};

/**
 * Shared “powered by Swagger UI” line (with link) for Developers embed and full-page docs.
 */
export function SwaggerPoweredByNote({ className }: SwaggerPoweredByNoteProps) {
  const t = useTranslations("Developers.openApiEmbed");

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {t.rich("swaggerIntro", {
        swaggerui: (chunks) => (
          <a
            href="https://swagger.io/tools/swagger-ui/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-primary"
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
