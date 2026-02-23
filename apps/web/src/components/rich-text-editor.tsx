"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", isActive && "bg-muted")}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
  minHeight = "min-h-28",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-w-0 flex-1 px-3 py-2 focus:outline-none [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const isEmpty = !value?.trim() || value === "<p></p>";
    const newIsEmpty = !currentHtml?.trim() || currentHtml === "<p></p>";
    if (value !== currentHtml && !(isEmpty && newIsEmpty)) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-md border border-input bg-muted-surface",
          minHeight,
          className,
        )}
      >
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          <div className="h-8 w-8 shrink-0" />
          <div className="h-8 w-8 shrink-0" />
          <div className="h-8 w-8 shrink-0" />
          <div className="h-8 w-8 shrink-0" />
        </div>
        <div className="flex-1 px-3 py-2 text-sm text-muted-foreground">
          {placeholder}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border border-input bg-muted-surface transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        minHeight,
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div
        className={cn(
          "flex-1 overflow-auto text-sm text-foreground [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:placeholder:text-muted-foreground",
          "[&_.ProseMirror_empty]:before:float-left [&_.ProseMirror_empty]:before:h-0 [&_.ProseMirror_empty]:before:content-[attr(data-placeholder)] [&_.ProseMirror_empty]:before:text-muted-foreground",
        )}
        data-placeholder={placeholder}
      >
        <EditorContent editor={editor} className="min-h-[100px]" />
      </div>
    </div>
  );
}
