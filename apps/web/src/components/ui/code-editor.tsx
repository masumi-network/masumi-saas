"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

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
  language?: string;
  height?: number | string;
  className?: string;
}

export function CodeEditor({
  value,
  language = "javascript",
  height = 280,
  className,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "vs-dark" : "light";

  return (
    <div className={className}>
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        theme={theme}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbers: "on",
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
}
