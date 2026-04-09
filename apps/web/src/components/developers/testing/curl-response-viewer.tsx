"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeEditor } from "@/components/ui/code-editor";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

interface CurlResponseViewerProps {
  curlCommand?: string;
  response?: object | null;
  error?: string | null;
}

export function CurlResponseViewer({
  curlCommand,
  response,
  error,
}: CurlResponseViewerProps) {
  const t = useTranslations("Developers.testing.curlViewer");
  const [curlExpanded, setCurlExpanded] = useState(false);

  const hasCurl = Boolean(curlCommand && curlCommand.length > 0);
  const hasResponse = response !== null && response !== undefined;
  const hasError = Boolean(error && error.length > 0);

  const responseCopyValue = hasError
    ? (error ?? "")
    : JSON.stringify(response, null, 2);

  if (!hasCurl && !hasResponse && !hasError) {
    return null;
  }

  const headerBar =
    "flex w-full flex-row items-center justify-between gap-3 space-y-0 border-b-0 border-border px-4 py-2.5 sm:px-5";

  return (
    <div className="space-y-3">
      {hasCurl && (
        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
          <CardHeader className={headerBar}>
            <button
              type="button"
              aria-expanded={curlExpanded}
              onClick={() => setCurlExpanded((v) => !v)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 text-left",
                "text-sm font-medium text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground bg-muted border -ml-2"
                aria-hidden
              >
                {curlExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 truncate">{t("curlTitle")}</span>
            </button>
            <CopyButton
              value={curlCommand ?? ""}
              className="shrink-0 text-muted-foreground"
            />
          </CardHeader>
          {curlExpanded && (
            <CardContent className="space-y-0 p-0">
              <div className="bg-muted/30 border-t border-border">
                <CodeEditor
                  value={curlCommand ?? ""}
                  language="shell"
                  height={220}
                  embedded
                />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {(hasResponse || hasError) && (
        <Card className="animate-fade-in gap-0 overflow-hidden py-0 shadow-sm">
          <CardHeader className={headerBar}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-medium leading-none text-foreground">
                {t("response")}
              </CardTitle>
              {hasError ? (
                <Badge
                  variant="destructive"
                  className="px-1.5 py-0 text-[10px] font-normal"
                >
                  {t("badgeError")}
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] font-normal"
                >
                  {t("badgeOk")}
                </Badge>
              )}
            </div>
            <CopyButton
              value={responseCopyValue}
              className="shrink-0 text-muted-foreground"
            />
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <div className="bg-muted/30 border-t border-border">
              {hasError ? (
                <CodeEditor
                  value={error ?? ""}
                  language="plaintext"
                  height={240}
                  embedded
                />
              ) : (
                <CodeEditor
                  value={JSON.stringify(response, null, 2)}
                  language="json"
                  height={300}
                  embedded
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
