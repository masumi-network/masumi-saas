"use client";

import sanitizeHtml from "sanitize-html";

import { cn } from "@/lib/utils";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "code",
  "pre",
  "blockquote",
];

interface HtmlContentProps {
  html: string;
  className?: string;
}

export function HtmlContent({ html, className }: HtmlContentProps) {
  const sanitized = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"] },
  });

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground",
        "prose-p:leading-relaxed prose-p:text-muted-foreground",
        "prose-strong:font-bold prose-strong:text-foreground",
        "prose-a:text-primary prose-a:underline prose-a:underline-offset-4",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
