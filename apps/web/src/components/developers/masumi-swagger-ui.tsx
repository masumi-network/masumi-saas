"use client";

/**
 * Swagger UI with shared `swagger-custom.css` and options (docExpansion, filter,
 * deepLinking, syntax theme via CSS).
 */

import "swagger-ui-react/swagger-ui.css";
import "@/../public/swagger-custom.css";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect } from "react";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

type MasumiSwaggerUiProps = {
  specUrl: string;
};

export function MasumiSwaggerUi({ specUrl }: MasumiSwaggerUiProps) {
  const { resolvedTheme } = useTheme();

  /** `swagger-custom.css` reads `:root[data-theme]` for light/dark. */
  useEffect(() => {
    if (!resolvedTheme) return;
    const el = document.documentElement;
    el.setAttribute("data-theme", resolvedTheme === "dark" ? "dark" : "light");
    return () => {
      el.removeAttribute("data-theme");
    };
  }, [resolvedTheme]);

  return (
    <SwaggerUI
      url={specUrl}
      docExpansion="list"
      defaultModelsExpandDepth={0}
      deepLinking
      filter
      persistAuthorization
      tryItOutEnabled
      displayRequestDuration
    />
  );
}
