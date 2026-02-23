"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  const components: Components = {
    strong: ({ children, ...props }) => (
      <strong {...props} className="font-bold text-foreground">
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em {...props} className="italic">
        {children}
      </em>
    ),
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4 hover:opacity-80"
      >
        {children}
      </a>
    ),
    code: ({ className: codeClassName, children, ...props }) => {
      const isInline =
        !codeClassName?.includes("language-") &&
        !String(children ?? "").includes("\n");

      if (isInline) {
        return (
          <code
            {...props}
            className={cn(
              "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
              codeClassName,
            )}
          >
            {children}
          </code>
        );
      }

      return (
        <code {...props} className={codeClassName}>
          {children}
        </code>
      );
    },
  };

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground",
        "prose-p:leading-relaxed prose-p:text-muted-foreground",
        "prose-strong:font-bold prose-strong:text-foreground",
        "prose-em:italic",
        "prose-ul:my-2 prose-li:my-0",
        "prose-headings:text-foreground prose-headings:font-medium",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks, remarkGfm]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
