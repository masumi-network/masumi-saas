"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const LOADING_EDITOR_LABEL = "Loading editor…";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        {LOADING_EDITOR_LABEL}
      </div>
    ),
  },
);

interface CodeEditorProps {
  value: string;
  /** When set, the editor is editable and changes are reported here. */
  onChange?: (value: string) => void;
  language?: string;
  height?: number | string;
  className?: string;
  /** Flat, borderless surface for embedding inside cards (read-only viewers). */
  embedded?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  height = 280,
  className,
  embedded = false,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "vs-dark" : "light";
  const readOnly = onChange == null;

  return (
    <div
      className={cn(
        embedded &&
          "[&_.monaco-editor]:rounded-none [&_.monaco-editor]:border-0 [&_.monaco-editor_.margin]:bg-transparent",
        className,
      )}
    >
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        theme={theme}
        onChange={readOnly ? undefined : (v) => onChange(v ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbers: "on",
          /** Embedded viewers: avoid breaking long JSON strings across lines in cURL. */
          wordWrap: embedded ? "off" : "on",
          padding: embedded ? { top: 8, bottom: 8 } : { top: 12, bottom: 12 },
          fixedOverflowWidgets: true,
          automaticLayout: true,
          tabSize: language === "json" ? 2 : 4,
          insertSpaces: true,
          /** Single surface with the card — no inner “second frame”. */
          ...(embedded
            ? {
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
              }
            : {}),
        }}
      />
    </div>
  );
}
