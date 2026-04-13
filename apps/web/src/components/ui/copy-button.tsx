"use client";

import { Check, Copy } from "lucide-react";
import { type MouseEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn("h-8 w-8", className)}
    >
      <span className="relative flex items-center justify-center h-4 w-4">
        <Copy
          className={cn(
            "h-4 w-4 absolute transition-all duration-200",
            copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <Check
          className={cn(
            "h-4 w-4 absolute text-green-500 transition-all duration-200",
            copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
          )}
        />
      </span>
    </Button>
  );
}
